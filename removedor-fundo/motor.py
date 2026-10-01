"""Motor de remoção de fundo, sem interface.

A rede neural só calcula a máscara (em 1024x1024); a máscara é ampliada para o
tamanho original e aplicada como canal alfa sobre os pixels ORIGINAIS da foto.
Nenhum pixel opaco é reamostrado, comprimido ou recolorido: a resolução e a
qualidade de entrada são preservadas. Só as bordas semitransparentes podem ter
a cor corrigida (opção "limpar halo"), para tirar a "sombra" do fundo antigo.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

# Modelos oferecidos na interface: (id do rembg, descrição).
MODELOS = {
    "birefnet-general": "BiRefNet geral — melhor qualidade (≈ 970 MB, mais lento)",
    "birefnet-portrait": "BiRefNet retratos — pessoas e cabelo (≈ 970 MB)",
    "birefnet-general-lite": "BiRefNet lite — bom equilíbrio (≈ 210 MB)",
    "isnet-general-use": "ISNet — rápido (≈ 170 MB)",
    "isnet-anime": "ISNet anime — desenhos e ilustrações (≈ 170 MB)",
}
MODELO_PADRAO = "birefnet-general"

EXTENSOES_ENTRADA = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif"}

# Formatos de saída, todos sem perdas e com transparência.
FORMATOS = {
    "PNG": ".png",
    "WebP sem perdas": ".webp",
    "TIFF (LZW)": ".tiff",
}

try:  # suporte opcional a fotos de iPhone
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:  # pragma: no cover
    EXTENSOES_ENTRADA -= {".heic", ".heif"}

Image.MAX_IMAGE_PIXELS = None  # aceita fotos muito grandes


@dataclass
class Opcoes:
    modelo: str = MODELO_PADRAO
    limpar_halo: bool = True
    suavizar_mascara: bool = False
    formato: str = "PNG"
    cor_fundo: Optional[Tuple[int, int, int]] = None  # None = transparente
    recortar: bool = False  # recorta as sobras transparentes ao redor do objeto


def provedores_disponiveis() -> list[str]:
    import onnxruntime as ort

    disponiveis = ort.get_available_providers()
    preferidos = ["CUDAExecutionProvider", "DmlExecutionProvider", "CPUExecutionProvider"]
    return [p for p in preferidos if p in disponiveis] or ["CPUExecutionProvider"]


class Removedor:
    """Mantém uma sessão do modelo carregada e processa imagens com ela."""

    def __init__(self) -> None:
        self._sessao = None
        self._nome_modelo: Optional[str] = None
        self._lock = threading.Lock()

    def acelerador(self) -> str:
        if self._sessao is None:
            return ""
        ativos = self._sessao.inner_session.get_providers()
        if "CUDAExecutionProvider" in ativos:
            return "GPU (CUDA)"
        if "DmlExecutionProvider" in ativos:
            return "GPU (DirectML)"
        return "CPU"

    def carregar(self, modelo: str) -> None:
        with self._lock:
            if self._sessao is not None and self._nome_modelo == modelo:
                return
            from rembg import new_session

            self._sessao = None
            try:
                self._sessao = new_session(modelo, providers=provedores_disponiveis())
            except Exception:
                # Driver de GPU com problema: cai para a CPU.
                self._sessao = new_session(modelo, providers=["CPUExecutionProvider"])
            self._nome_modelo = modelo

    def mascara(self, img: Image.Image, modelo: str) -> Image.Image:
        self.carregar(modelo)
        with self._lock:
            mascara = self._sessao.predict(img.convert("RGB"))[0]
        if mascara.size != img.size:
            mascara = mascara.resize(img.size, Image.Resampling.LANCZOS)
        return _esticar_niveis(mascara.convert("L"))

    def processar(self, img: Image.Image, opcoes: Opcoes) -> Image.Image:
        """Recebe a imagem já aberta e devolve o recorte RGBA no mesmo tamanho."""
        img = ImageOps.exif_transpose(img)
        rgb = _para_rgb(img)

        alfa = np.asarray(self.mascara(rgb, opcoes.modelo), dtype=np.uint8)
        if opcoes.suavizar_mascara:
            from rembg.bg import post_process

            alfa = post_process(alfa)

        # Se a imagem já tinha transparência, mantém o que era transparente.
        if "A" in img.getbands():
            alfa_original = np.asarray(img.getchannel("A"), dtype=np.uint16)
            alfa = (alfa.astype(np.uint16) * alfa_original // 255).astype(np.uint8)

        cores = np.asarray(rgb, dtype=np.uint8)
        if opcoes.limpar_halo:
            cores = _limpar_halo(cores, alfa)

        resultado = Image.fromarray(np.dstack([cores, alfa]), "RGBA")

        if opcoes.recortar:
            caixa = resultado.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
            if caixa:
                resultado = resultado.crop(caixa)

        if opcoes.cor_fundo is not None:
            fundo = Image.new("RGBA", resultado.size, (*opcoes.cor_fundo, 255))
            resultado = Image.alpha_composite(fundo, resultado).convert("RGB")

        return resultado


def _esticar_niveis(mascara: Image.Image, preto: int = 4, branco: int = 248) -> Image.Image:
    """Garante que o objeto fique 100% opaco e o fundo 100% transparente.

    O modelo devolve ~254 no lugar de 255 dentro do objeto (e ~1 no fundo), o
    que deixaria a foto inteira levemente transparente. Os níveis são esticados
    de forma linear, sem perder a suavidade das bordas.
    """
    escala = 255.0 / (branco - preto)
    return mascara.point(lambda v: max(0, min(255, round((v - preto) * escala))))


def _para_rgb(img: Image.Image) -> Image.Image:
    if img.mode == "RGB":
        return img
    if img.mode in ("I;16", "I;16B", "I;16L", "I"):
        # 16 bits em tons de cinza: reduz para 8 bits sem estourar.
        arr = np.asarray(img, dtype=np.float64)
        arr = np.clip(arr / (65535.0 if arr.max() > 255 else 255.0) * 255.0, 0, 255)
        return Image.fromarray(arr.round().astype(np.uint8), "L").convert("RGB")
    if img.mode == "CMYK":
        # Mantém fiel ao perfil de cor, se houver; senão, conversão padrão.
        return img.convert("RGB")
    return img.convert("RGBA").convert("RGB") if "A" in img.getbands() else img.convert("RGB")


def _limpar_halo(cores: np.ndarray, alfa: np.ndarray) -> np.ndarray:
    """Remove a cor do fundo antigo SÓ nas bordas semitransparentes.

    Pixels totalmente opacos continuam com a cor original, bit a bit.
    """
    borda = (alfa > 0) & (alfa < 255)
    if not borda.any():
        return cores

    # Trabalha só no retângulo que contém as bordas (com margem), para economizar
    # memória e tempo em fotos grandes.
    ys, xs = np.nonzero(borda)
    margem = 16
    y0, y1 = max(ys.min() - margem, 0), min(ys.max() + margem + 1, alfa.shape[0])
    x0, x1 = max(xs.min() - margem, 0), min(xs.max() + margem + 1, alfa.shape[1])

    from pymatting.foreground.estimate_foreground_ml import estimate_foreground_ml

    recorte = cores[y0:y1, x0:x1].astype(np.float64) / 255.0
    a = alfa[y0:y1, x0:x1].astype(np.float64) / 255.0
    frente = estimate_foreground_ml(recorte, a)
    frente = np.clip(frente * 255.0 + 0.5, 0, 255).astype(np.uint8)

    saida = cores.copy()
    sub = saida[y0:y1, x0:x1]
    so_borda = borda[y0:y1, x0:x1]
    sub[so_borda] = frente[so_borda]
    return saida


def caminho_saida(entrada: Path, pasta: Optional[Path], formato: str) -> Path:
    destino = pasta if pasta else entrada.parent
    base = destino / f"{entrada.stem}_sem_fundo{FORMATOS[formato]}"
    n = 2
    caminho = base
    while caminho.exists():
        caminho = base.with_name(f"{entrada.stem}_sem_fundo_{n}{FORMATOS[formato]}")
        n += 1
    return caminho


def salvar(img: Image.Image, caminho: Path, formato: str, original: Image.Image) -> None:
    """Salva sem perdas, levando junto perfil de cor e DPI do original."""
    extras = {}
    icc = original.info.get("icc_profile")
    if icc:
        extras["icc_profile"] = icc
    dpi = original.info.get("dpi")
    if dpi:
        extras["dpi"] = tuple(float(d) for d in dpi)

    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_name(caminho.name + ".tmp")
    if formato == "PNG":
        img.save(tmp, "PNG", compress_level=6, **extras)
    elif formato == "WebP sem perdas":
        extras.pop("dpi", None)
        img.save(tmp, "WEBP", lossless=True, quality=100, method=6, exact=True, **extras)
    else:
        img.save(tmp, "TIFF", compression="tiff_lzw", **extras)
    os.replace(tmp, caminho)


def processar_arquivo(
    removedor: Removedor,
    entrada: Path,
    opcoes: Opcoes,
    pasta_saida: Optional[Path] = None,
) -> Path:
    with Image.open(entrada) as original:
        original.load()
        resultado = removedor.processar(original, opcoes)
        destino = caminho_saida(entrada, pasta_saida, opcoes.formato)
        salvar(resultado, destino, opcoes.formato, original)
    return destino


def listar_imagens(caminhos, recursivo: bool = True) -> list[Path]:
    encontrados: list[Path] = []
    for c in caminhos:
        p = Path(c)
        if p.is_dir():
            itens = p.rglob("*") if recursivo else p.glob("*")
            encontrados += sorted(
                f for f in itens
                if f.suffix.lower() in EXTENSOES_ENTRADA and "_sem_fundo" not in f.stem
            )
        elif p.suffix.lower() in EXTENSOES_ENTRADA:
            encontrados.append(p)
    vistos, unicos = set(), []
    for f in encontrados:
        chave = str(f.resolve()).lower()
        if chave not in vistos:
            vistos.add(chave)
            unicos.append(f)
    return unicos


"""Removedor de Fundo — interface gráfica para Windows.

Arraste imagens ou pastas para a janela (ou use os botões), escolha as opções
e clique em "Remover fundo". Os arquivos saem com "_sem_fundo" no nome, em
formato sem perdas e na resolução original.
"""

from __future__ import annotations

import os
import queue
import re
import sys
import threading
import traceback
from pathlib import Path
from tkinter import colorchooser, filedialog, messagebox, ttk
import tkinter as tk

from PIL import Image, ImageOps, ImageTk

import motor

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD

    BaseTk = TkinterDnD.Tk
    TEM_DND = True
except Exception:  # sem arrastar-e-soltar, os botões continuam funcionando
    BaseTk = tk.Tk
    TEM_DND = False

TITULO = "Removedor de Fundo"
TAM_PREVIA = 320


def xadrez(largura: int, altura: int, lado: int = 12) -> Image.Image:
    img = Image.new("RGB", (largura, altura), (255, 255, 255))
    cinza = Image.new("RGB", (lado, lado), (204, 204, 204))
    for y in range(0, altura, lado):
        for x in range((y // lado) % 2 * lado, largura, lado * 2):
            img.paste(cinza, (x, y))
    return img


class App(BaseTk):
    def __init__(self) -> None:
        super().__init__()
        self.title(TITULO)
        self.minsize(900, 620)
        self._definir_icone()

        self.arquivos: list[Path] = []
        self.pasta_saida: Path | None = None
        self.cor_fundo: tuple[int, int, int] | None = None
        self.removedor = motor.Removedor()
        self.fila: queue.Queue = queue.Queue()
        self.trabalhando = False
        self.cancelar = threading.Event()
        self._fotos: list[ImageTk.PhotoImage] = []

        self._montar()
        self.after(100, self._ler_fila)

    # ---------- interface ----------

    def _definir_icone(self) -> None:
        icone = Path(getattr(sys, "_MEIPASS", Path(__file__).parent)) / "icone.ico"
        if icone.exists():
            try:
                self.iconbitmap(default=str(icone))
            except tk.TclError:
                pass

    def _montar(self) -> None:
        estilo = ttk.Style(self)
        if "vista" in estilo.theme_names():
            estilo.theme_use("vista")
        estilo.configure("Grande.TButton", padding=(16, 8), font=("Segoe UI", 11, "bold"))

        raiz = ttk.Frame(self, padding=12)
        raiz.pack(fill="both", expand=True)
        raiz.columnconfigure(0, weight=1)
        raiz.columnconfigure(1, weight=2)
        raiz.rowconfigure(0, weight=1)

        # --- coluna da esquerda: lista de arquivos ---
        esq = ttk.Frame(raiz)
        esq.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        esq.rowconfigure(1, weight=1)
        esq.columnconfigure(0, weight=1)

        dica = "Arraste imagens ou pastas para cá" if TEM_DND else "Adicione imagens ou pastas"
        ttk.Label(esq, text=dica, font=("Segoe UI", 10, "bold")).grid(row=0, column=0, sticky="w")

        moldura = ttk.Frame(esq)
        moldura.grid(row=1, column=0, sticky="nsew", pady=6)
        moldura.rowconfigure(0, weight=1)
        moldura.columnconfigure(0, weight=1)
        self.lista = tk.Listbox(moldura, selectmode="extended", activestyle="none", height=12)
        self.lista.grid(row=0, column=0, sticky="nsew")
        barra = ttk.Scrollbar(moldura, orient="vertical", command=self.lista.yview)
        barra.grid(row=0, column=1, sticky="ns")
        self.lista.configure(yscrollcommand=barra.set)
        self.lista.bind("<<ListboxSelect>>", lambda e: self._mostrar_previa())
        self.lista.bind("<Delete>", lambda e: self._remover_selecionados())

        if TEM_DND:
            for alvo in (self.lista, self):
                alvo.drop_target_register(DND_FILES)
                alvo.dnd_bind("<<Drop>>", self._ao_soltar)

        botoes = ttk.Frame(esq)
        botoes.grid(row=2, column=0, sticky="ew")
        ttk.Button(botoes, text="Adicionar imagens…", command=self._adicionar_arquivos).pack(side="left")
        ttk.Button(botoes, text="Adicionar pasta…", command=self._adicionar_pasta).pack(side="left", padx=6)
        ttk.Button(botoes, text="Limpar", command=self._limpar).pack(side="right")

        # --- coluna da direita: prévia e opções ---
        dir_ = ttk.Frame(raiz)
        dir_.grid(row=0, column=1, sticky="nsew")
        dir_.columnconfigure(0, weight=1)
        dir_.columnconfigure(1, weight=1)

        ttk.Label(dir_, text="Original").grid(row=0, column=0)
        ttk.Label(dir_, text="Sem fundo").grid(row=0, column=1)
        self.previa_antes = ttk.Label(dir_, anchor="center")
        self.previa_antes.grid(row=1, column=0, padx=4, pady=4)
        self.previa_depois = ttk.Label(dir_, anchor="center")
        self.previa_depois.grid(row=1, column=1, padx=4, pady=4)
        vazio = ImageTk.PhotoImage(xadrez(TAM_PREVIA, TAM_PREVIA))
        self._vazio = vazio
        self.previa_antes.configure(image=vazio)
        self.previa_depois.configure(image=vazio)
        ttk.Button(dir_, text="Testar na imagem selecionada", command=self._testar_previa).grid(
            row=2, column=0, columnspan=2, pady=(0, 8)
        )

        opc = ttk.LabelFrame(dir_, text="Opções", padding=10)
        opc.grid(row=3, column=0, columnspan=2, sticky="ew")
        opc.columnconfigure(1, weight=1)

        ttk.Label(opc, text="Modelo:").grid(row=0, column=0, sticky="w")
        self.var_modelo = tk.StringVar(value=motor.MODELOS[motor.MODELO_PADRAO])
        self.combo_modelo = ttk.Combobox(
            opc, textvariable=self.var_modelo, values=list(motor.MODELOS.values()), state="readonly"
        )
        self.combo_modelo.grid(row=0, column=1, columnspan=2, sticky="ew", pady=2)

        ttk.Label(opc, text="Formato:").grid(row=1, column=0, sticky="w")
        self.var_formato = tk.StringVar(value="PNG")
        ttk.Combobox(
            opc, textvariable=self.var_formato, values=list(motor.FORMATOS), state="readonly", width=18
        ).grid(row=1, column=1, sticky="w", pady=2)

        self.var_halo = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            opc, text="Limpar halo do fundo nas bordas (cabelo, pelos)", variable=self.var_halo
        ).grid(row=2, column=0, columnspan=3, sticky="w")
        self.var_suavizar = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            opc, text="Bordas firmes (para objetos e produtos, não para cabelo)", variable=self.var_suavizar
        ).grid(row=3, column=0, columnspan=3, sticky="w")
        self.var_recortar = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            opc, text="Recortar a sobra transparente ao redor do objeto", variable=self.var_recortar
        ).grid(row=4, column=0, columnspan=3, sticky="w")

        self.var_usar_cor = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            opc, text="Pôr fundo de cor sólida", variable=self.var_usar_cor
        ).grid(row=5, column=0, columnspan=2, sticky="w")
        self.amostra_cor = tk.Label(opc, width=3, bg="#ffffff", relief="solid", bd=1)
        self.amostra_cor.grid(row=5, column=2, sticky="e")
        self.amostra_cor.bind("<Button-1>", lambda e: self._escolher_cor())
        self.cor_fundo = (255, 255, 255)

        ttk.Label(opc, text="Salvar em:").grid(row=6, column=0, sticky="w", pady=(6, 0))
        self.var_saida = tk.StringVar(value="Mesma pasta da imagem original")
        ttk.Label(opc, textvariable=self.var_saida, foreground="#555").grid(
            row=6, column=1, sticky="w", pady=(6, 0)
        )
        ttk.Button(opc, text="Alterar…", command=self._escolher_saida).grid(row=6, column=2, sticky="e", pady=(6, 0))

        # --- rodapé ---
        rodape = ttk.Frame(raiz)
        rodape.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        rodape.columnconfigure(0, weight=1)
        self.progresso = ttk.Progressbar(rodape, mode="determinate")
        self.progresso.grid(row=0, column=0, sticky="ew", padx=(0, 12))
        self.botao = ttk.Button(rodape, text="Remover fundo", style="Grande.TButton", command=self._iniciar)
        self.botao.grid(row=0, column=1)
        self.var_status = tk.StringVar(value="Pronto.")
        ttk.Label(rodape, textvariable=self.var_status).grid(row=1, column=0, columnspan=2, sticky="w", pady=(6, 0))

    # ---------- arquivos ----------

    def _ao_soltar(self, evento) -> None:
        self._adicionar(self.tk.splitlist(evento.data))

    def _adicionar_arquivos(self) -> None:
        tipos = " ".join(f"*{e}" for e in sorted(motor.EXTENSOES_ENTRADA))
        nomes = filedialog.askopenfilenames(
            title="Escolha as imagens", filetypes=[("Imagens", tipos), ("Todos os arquivos", "*.*")]
        )
        self._adicionar(nomes)

    def _adicionar_pasta(self) -> None:
        pasta = filedialog.askdirectory(title="Escolha a pasta com as imagens")
        if pasta:
            self._adicionar([pasta])

    def _adicionar(self, caminhos) -> None:
        if self.trabalhando:
            return
        novos = [p for p in motor.listar_imagens(caminhos) if p not in self.arquivos]
        if not novos and caminhos:
            self.var_status.set("Nenhuma imagem compatível encontrada.")
            return
        for p in novos:
            self.arquivos.append(p)
            self.lista.insert("end", p.name)
        self.var_status.set(f"{len(self.arquivos)} imagem(ns) na lista.")
        if self.lista.size() and not self.lista.curselection():
            self.lista.selection_set(0)
            self._mostrar_previa()

    def _remover_selecionados(self) -> None:
        if self.trabalhando:
            return
        for i in reversed(self.lista.curselection()):
            self.lista.delete(i)
            del self.arquivos[i]
        self.var_status.set(f"{len(self.arquivos)} imagem(ns) na lista.")

    def _limpar(self) -> None:
        if self.trabalhando:
            return
        self.lista.delete(0, "end")
        self.arquivos.clear()
        self.previa_antes.configure(image=self._vazio)
        self.previa_depois.configure(image=self._vazio)
        self.var_status.set("Pronto.")

    def _escolher_saida(self) -> None:
        pasta = filedialog.askdirectory(title="Onde salvar as imagens sem fundo?")
        if pasta:
            self.pasta_saida = Path(pasta)
            self.var_saida.set(str(self.pasta_saida))
        else:
            self.pasta_saida = None
            self.var_saida.set("Mesma pasta da imagem original")

    def _escolher_cor(self) -> None:
        cor = colorchooser.askcolor(color="#%02x%02x%02x" % self.cor_fundo, title="Cor do fundo")
        if cor and cor[0]:
            self.cor_fundo = tuple(int(c) for c in cor[0])
            self.amostra_cor.configure(bg=cor[1])
            self.var_usar_cor.set(True)

    # ---------- prévia ----------

    def _selecionado(self) -> Path | None:
        sel = self.lista.curselection()
        return self.arquivos[sel[0]] if sel else None

    def _miniatura(self, img: Image.Image) -> ImageTk.PhotoImage:
        img = img.copy()
        img.thumbnail((TAM_PREVIA, TAM_PREVIA), Image.Resampling.LANCZOS)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            fundo = xadrez(*img.size).convert("RGBA")
            img = Image.alpha_composite(fundo, img)
        foto = ImageTk.PhotoImage(img.convert("RGB"))
        self._fotos.append(foto)
        self._fotos = self._fotos[-4:]
        return foto

    def _mostrar_previa(self) -> None:
        caminho = self._selecionado()
        if not caminho:
            return
        try:
            with Image.open(caminho) as img:
                img = ImageOps.exif_transpose(img)
                self.previa_antes.configure(image=self._miniatura(img))
                self.var_status.set(f"{caminho.name} — {img.width} × {img.height} px")
        except Exception as erro:
            self.var_status.set(f"Não consegui abrir {caminho.name}: {erro}")
        self.previa_depois.configure(image=self._vazio)

    def _testar_previa(self) -> None:
        caminho = self._selecionado()
        if not caminho:
            messagebox.showinfo(TITULO, "Selecione uma imagem da lista primeiro.")
            return
        if self.trabalhando:
            return
        self._comecar_trabalho(previa=caminho)

    # ---------- processamento ----------

    def _opcoes(self) -> motor.Opcoes:
        nome = self.var_modelo.get()
        modelo = next((k for k, v in motor.MODELOS.items() if v == nome), motor.MODELO_PADRAO)
        return motor.Opcoes(
            modelo=modelo,
            limpar_halo=self.var_halo.get(),
            suavizar_mascara=self.var_suavizar.get(),
            formato=self.var_formato.get(),
            cor_fundo=self.cor_fundo if self.var_usar_cor.get() else None,
            recortar=self.var_recortar.get(),
        )

    def _iniciar(self) -> None:
        if self.trabalhando:
            self.cancelar.set()
            self.botao.configure(text="Cancelando…", state="disabled")
            return
        if not self.arquivos:
            messagebox.showinfo(TITULO, "Adicione pelo menos uma imagem.")
            return
        self._comecar_trabalho()

    def _comecar_trabalho(self, previa: Path | None = None) -> None:
        self.trabalhando = True
        self.cancelar.clear()
        self.botao.configure(text="Cancelar")
        opcoes = self._opcoes()
        arquivos = [previa] if previa else list(self.arquivos)
        self.progresso.configure(maximum=len(arquivos), value=0)
        threading.Thread(
            target=self._trabalhar, args=(arquivos, opcoes, previa is not None), daemon=True
        ).start()

    def _trabalhar(self, arquivos: list[Path], opcoes: motor.Opcoes, so_previa: bool) -> None:
        f = self.fila.put
        try:
            if not self.removedor._sessao or self.removedor._nome_modelo != opcoes.modelo:
                f(("status", "Preparando… (a primeira vez demora alguns minutos: baixa o modelo e prepara o motor)"))
                self.removedor.carregar(opcoes.modelo)
            acel = self.removedor.acelerador()

            if so_previa:
                f(("status", f"Gerando prévia… ({acel})"))
                with Image.open(arquivos[0]) as img:
                    img.load()
                    resultado = self.removedor.processar(img, opcoes)
                f(("previa", resultado))
                f(("progresso", 1))
                f(("fim", "Prévia pronta. Gostou? Clique em “Remover fundo” para salvar."))
                return

            ok, erros = 0, []
            for i, caminho in enumerate(arquivos):
                if self.cancelar.is_set():
                    break
                f(("status", f"[{i + 1}/{len(arquivos)}] {caminho.name} ({acel})"))
                try:
                    destino = motor.processar_arquivo(self.removedor, caminho, opcoes, self.pasta_saida)
                    ok += 1
                    ultimo = destino
                except Exception as erro:
                    erros.append(f"{caminho.name}: {erro}")
                f(("progresso", i + 1))

            msg = f"{ok} imagem(ns) salva(s)."
            if self.cancelar.is_set():
                msg += " Cancelado."
            if erros:
                msg += f" {len(erros)} com erro."
                f(("erros", erros))
            f(("fim", msg))
            if ok:
                f(("abrir", ultimo.parent))
        except Exception:
            f(("erro_fatal", traceback.format_exc()))

    def _ler_fila(self) -> None:
        try:
            while True:
                tipo, valor = self.fila.get_nowait()
                if tipo == "status":
                    self.var_status.set(valor)
                elif tipo == "progresso":
                    self.progresso.configure(value=valor)
                elif tipo == "previa":
                    self.previa_depois.configure(image=self._miniatura(valor))
                elif tipo == "erros":
                    messagebox.showwarning(TITULO, "Algumas imagens falharam:\n\n" + "\n".join(valor[:15]))
                elif tipo == "abrir":
                    if sys.platform == "win32" and messagebox.askyesno(TITULO, "Concluído! Abrir a pasta?"):
                        os.startfile(valor)
                elif tipo == "erro_fatal":
                    self._terminar("Erro.")
                    messagebox.showerror(TITULO, "Ocorreu um erro:\n\n" + valor[-1500:])
                elif tipo == "fim":
                    self._terminar(valor)
        except queue.Empty:
            pass
        self.after(100, self._ler_fila)

    def _terminar(self, msg: str) -> None:
        self.trabalhando = False
        self.botao.configure(text="Remover fundo", state="normal")
        self.var_status.set(msg)


class SaidaDoDownload:
    """Recebe a barra de progresso do download do modelo e mostra na janela.

    No .exe sem console, sys.stderr é None e a barra quebraria o programa.
    """

    def __init__(self, fila: queue.Queue) -> None:
        self.fila = fila
        self.ultimo = -1

    def write(self, texto: str) -> int:
        achados = re.findall(r"(\d+)%\|", texto)
        if achados:
            pct = int(achados[-1])
            if pct != self.ultimo:
                self.ultimo = pct
                self.fila.put(("status", f"Baixando o modelo (só na primeira vez)… {pct}%"))
        return len(texto)

    def flush(self) -> None:
        pass

    def isatty(self) -> bool:
        return False


def linha_de_comando(args: list[str]) -> int:
    """Modo sem janela: RemovedorDeFundo.exe --sem-janela [--modelo M] [--saida PASTA] arquivos/pastas"""
    import argparse

    p = argparse.ArgumentParser(prog="RemovedorDeFundo", add_help=False)
    p.add_argument("--sem-janela", action="store_true")
    p.add_argument("--modelo", default=motor.MODELO_PADRAO, choices=list(motor.MODELOS))
    p.add_argument("--formato", default="PNG", choices=list(motor.FORMATOS))
    p.add_argument("--saida")
    p.add_argument("--sem-limpar-halo", action="store_true")
    p.add_argument("--recortar", action="store_true")
    p.add_argument("entradas", nargs="+")
    o = p.parse_args(args)
    opcoes = motor.Opcoes(
        modelo=o.modelo, formato=o.formato, limpar_halo=not o.sem_limpar_halo, recortar=o.recortar
    )
    removedor = motor.Removedor()
    erros = 0
    for caminho in motor.listar_imagens(o.entradas):
        try:
            destino = motor.processar_arquivo(removedor, caminho, opcoes, Path(o.saida) if o.saida else None)
            print(f"{caminho} -> {destino}")
        except Exception as erro:
            erros += 1
            print(f"ERRO {caminho}: {erro}", file=sys.stderr)
    return 1 if erros else 0


def main() -> None:
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    if "--sem-janela" in sys.argv:
        sys.exit(linha_de_comando(sys.argv[1:]))

    if sys.platform == "win32":
        try:  # nitidez em telas com escala (125%, 150%…)
            import ctypes

            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    app = App()
    sys.stderr = SaidaDoDownload(app.fila)
    if len(sys.argv) > 1:  # arquivos arrastados sobre o ícone / "Abrir com"
        app.after(200, lambda: app._adicionar(sys.argv[1:]))
    app.mainloop()


if __name__ == "__main__":
    main()

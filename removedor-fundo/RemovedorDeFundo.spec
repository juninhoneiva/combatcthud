# -*- mode: python ; coding: utf-8 -*-
# Gera dist/RemovedorDeFundo/RemovedorDeFundo.exe com:  pyinstaller RemovedorDeFundo.spec
from PyInstaller.utils.hooks import collect_all, copy_metadata

datas, binaries, hiddenimports = [("icone.ico", ".")], [], []
for pacote in ("rembg", "pymatting", "tkinterdnd2", "onnxruntime", "pillow_heif", "skimage"):
    try:
        d, b, h = collect_all(pacote)
    except Exception:
        continue
    datas += d
    binaries += b
    hiddenimports += h
for pacote in ("rembg", "pymatting", "pooch", "numba"):
    try:
        datas += copy_metadata(pacote)
    except Exception:
        pass

a = Analysis(
    ["app.py"],
    datas=datas,
    binaries=binaries,
    hiddenimports=hiddenimports,
    excludes=["matplotlib", "pandas", "IPython", "pytest", "gradio", "fastapi"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="RemovedorDeFundo",
    icon="icone.ico",
    console=False,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, name="RemovedorDeFundo", upx=False)

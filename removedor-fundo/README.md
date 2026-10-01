# Removedor de Fundo (Windows)

Programa para Windows que tira o fundo de fotos **sem perder qualidade**:

- **Resolução original**: a foto não é reduzida. A inteligência artificial só
  calcula a máscara (o que é objeto e o que é fundo), e essa máscara é aplicada
  sobre os **pixels originais**. Os pixels do objeto saem idênticos aos da foto.
- **Formatos sem perdas**: PNG, WebP sem perdas ou TIFF, com transparência.
  O perfil de cor (ICC) e o DPI do original são mantidos.
- **Bordas limpas**: a opção *Limpar halo* tira a "sombra" da cor do fundo
  antigo nas bordas semitransparentes (cabelo, pelos), sem mexer no resto.
- Processa **várias imagens ou pastas inteiras** de uma vez, com prévia antes
  de salvar.
- Roda **offline** no seu computador, e as imagens não são enviadas para lugar
  nenhum. Usa a placa de vídeo (DirectML) quando houver; senão, o processador.

## Como baixar

1. Na aba **Actions** do GitHub, abra a última execução verde de
   **Removedor de Fundo (Windows)**.
2. Em **Artifacts**, baixe `RemovedorDeFundo-windows` e descompacte.
3. Abra a pasta `RemovedorDeFundo` e execute **`RemovedorDeFundo.exe`**
   (mantenha o .exe junto da pasta `_internal`).

> Na primeira vez, o Windows SmartScreen pode avisar que o programa não é
> reconhecido: clique em **Mais informações → Executar assim mesmo**.
> Também na primeira vez, o modelo escolhido é baixado (de 170 MB a 970 MB) e
> o motor é preparado, o que leva alguns minutos. Depois disso é rápido.

## Como usar

1. Arraste imagens ou pastas para a janela (ou use **Adicionar imagens/pasta**).
2. Opcional: selecione uma imagem e clique em **Testar na imagem selecionada**.
3. Clique em **Remover fundo**. Os arquivos são salvos como
   `nome_sem_fundo.png` na mesma pasta (ou na pasta escolhida em *Salvar em*).

| Modelo | Quando usar |
|---|---|
| BiRefNet geral (padrão) | Melhor qualidade em geral |
| BiRefNet retratos | Pessoas, cabelo |
| BiRefNet lite | Computador mais modesto |
| ISNet | Rápido, para muitas imagens simples |
| ISNet anime | Desenhos e ilustrações |

**Bordas firmes** deixa o contorno nítido (bom para produtos e objetos).
**Recortar** tira a área transparente que sobra em volta do objeto.
**Fundo de cor sólida** troca o fundo por uma cor (ex.: branco para lojas virtuais).

### Linha de comando

```
RemovedorDeFundo.exe --sem-janela [--modelo birefnet-general] [--formato PNG] [--saida PASTA] [--recortar] fotos_ou_pastas...
```

## Rodar a partir do código

```
pip install -r requirements.txt
python app.py
```

Para gerar o .exe localmente: `pip install pyinstaller` e
`pyinstaller RemovedorDeFundo.spec` (o resultado fica em `dist/RemovedorDeFundo`).

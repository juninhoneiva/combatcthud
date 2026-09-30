# Changelog

## v0.2.2

### Novidades

- **Integração com o PopOut!**: com o módulo [PopOut!](https://github.com/League-of-Foundry-Developers/fvtt-module-popout) ativo, o cabeçalho do HUD ganha um botão para abrir o HUD numa janela separada (ótimo para um segundo monitor). O mesmo botão o traz de volta. Na janela separada, o HUD ocupa o espaço todo e os cartões se esticam. Há também um atalho de teclado opcional em **Configurar Controles**.

### Mudanças

- **Cartões respeitam o tipo de rolagem**:
  - **pública**: todos veem, com os resultados dos dados já abertos;
  - **privada**: só o mestre e quem rolou;
  - **cega**: o mestre vê tudo; quem rolou vê o cartão sem os resultados; os demais não veem;
  - **só para mim**: só quem rolou, nem o mestre.
  - Cartões não públicos ganham um selo indicando o tipo de rolagem.
- **Cartões limpos a cada rodada**: o HUD mostra só os cartões da rodada atual, e no chat continuam todos. A nova opção **Limpar cartões do HUD** permite limpar a cada rodada (padrão), a cada turno ou nunca.

## v0.2.1

### Mudanças

- **Cartões ao lado**: o HUD agora tem duas colunas. Iniciativa, investigador e dano rápido ficam à esquerda, e os cartões do CoC7 à direita, numa coluna mais larga e fácil de ler.

### Correções

- **PV privados**: jogadores só veem os pontos de vida dos próprios investigadores. A barrinha de PV na iniciativa aparece apenas para o mestre e para o dono do personagem.
- As mensagens do dano rápido, que mostram o PV resultante, agora vão só para o mestre e para o dono do ator atingido.

## v0.2.0

### Novidades

- **Nova skin Pulp**, no visual de capa de revista pulp dos anos 30:
  - papel jornal com retícula, contorno preto grosso e sombras duras;
  - título "COMBATE!" em estilo quadrinho e faixas inclinadas nos títulos de seção;
  - retrato do investigador numa "explosão" amarela e botões que afundam ao clicar;
  - arma sem munição "tremendo".
- **Nova skin Moderna**, um HUD tático para campanhas na era moderna:
  - vidro fosco escuro com cantos arredondados e destaque ciano;
  - barras finas com brilho e indicador "ao vivo" no cabeçalho;
  - cartões do sistema em painéis claros.
- Para trocar de skin: **Configurações → Combat Cthulhu HUD → Visual**. É por usuário, então cada jogador escolhe a sua.

## v0.1.1

### Novidades

- **Recarregar arma no HUD**: armas de fogo mostram a munição atual e a capacidade (ex.: `2/6`) ao lado do botão de ataque.
  - **Clique**: recarrega o pente e anuncia no chat.
  - **Shift+clique**: coloca uma bala.
  - **Botão direito**: tira uma bala.
  - Arma vazia fica em vermelho, pulsando.
- O contador acompanha os disparos feitos pelos cartões do CoC7 e pela ficha.

## v0.1.0

Primeira versão: iniciativa, PV/PM/SAN/Sorte, condições, ações rápidas, dano rápido, cartões do CoC7 jogáveis dentro do HUD e skin Anos 20 (Art Déco).

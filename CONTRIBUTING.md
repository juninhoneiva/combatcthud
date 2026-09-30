# Desenvolvimento

## Estrutura

```
module.json           manifesto
scripts/main.js       hooks e inicialização
scripts/hud.js        aplicação (ApplicationV2) do HUD
scripts/cards.js      cartões do CoC7 renderizados no HUD
scripts/actor-data.js leitura de PV/PM/SAN/Sorte, condições, armas e perícias
scripts/constants.js  constantes (tipos de cartão, condições, skins)
templates/hud.hbs     layout
styles/               estilo base, skins e fontes
lang/                 pt-BR e en
```

## Publicar uma versão

A publicação é automática:

1. Aumente `version` no `module.json` e descreva a versão no `CHANGELOG.md`, numa seção `## vX.Y.Z`.
2. Faça o merge na `main`.
3. O workflow `.github/workflows/release.yml` cria o release `vX.Y.Z` com as notas do CHANGELOG. Ele também gera o `module.zip` e anexa `module.json` e `module.zip` ao release.

Para publicar manualmente, use **Actions → Release → Run workflow**. Se o release da versão já existir, o workflow não faz nada.

## Criar uma skin

1. Crie `styles/skin-<id>.css`, usando `styles/skin-pulp.css` ou `styles/skin-modern.css` como modelo:
   - redefina as variáveis em `.combatcthud.skin-<id>`;
   - para mudar formas, sobrescreva os seletores com `#combatcthud.skin-<id> ...`.
2. Adicione o arquivo em `module.json` → `styles`.
3. Registre a skin em `SKINS`, em `scripts/constants.js`, e crie a tradução em `lang/*.json` (`COMBATCTHUD.Skins.<id>`).
4. Se usar fontes novas, coloque o `.woff2` e a licença em `fonts/` e declare o `@font-face` em `styles/fonts.css`.

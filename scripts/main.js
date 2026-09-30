import { MODULE_ID, SYSTEM_ID } from './constants.js'
import { CardFeed } from './cards.js'
import { CombatCthulhuHUD } from './hud.js'
import { getSetting, registerSettings } from './settings.js'

/** @type {CombatCthulhuHUD|null} */
let hud = null
const refresh = () => hud?.refresh()

Hooks.once('init', () => {
  registerSettings(refresh)

  game.keybindings.register(MODULE_ID, 'toggle', {
    name: 'COMBATCTHUD.Keybindings.toggle',
    editable: [{ key: 'KeyH', modifiers: ['Shift'] }],
    onDown: () => { hud?.toggle(); return true }
  })

  // Sem atalho padrão; o usuário define em Configurar Controles.
  game.keybindings.register(MODULE_ID, 'popout', {
    name: 'COMBATCTHUD.Keybindings.popout',
    editable: [],
    onDown: () => { hud?.togglePopout(); return true }
  })
})

Hooks.once('ready', () => {
  if (game.system.id !== SYSTEM_ID) {
    ui.notifications.warn('COMBATCTHUD.Notify.wrongSystem', { localize: true })
    return
  }
  hud = new CombatCthulhuHUD()
  game.modules.get(MODULE_ID).api = {
    hud,
    toggle: () => hud.toggle(),
    popout: () => hud.togglePopout(),
    render: () => hud.refresh()
  }
  hud.cards.seed()
})

/* -------------------------------------------- */
/*  Botão nos controles de cena (grupo Tokens)  */
/* -------------------------------------------- */

Hooks.on('getSceneControlButtons', (controls) => {
  const tokens = controls.tokens ?? controls.token
  if (!tokens?.tools) return
  tokens.tools[MODULE_ID] = {
    name: MODULE_ID,
    title: 'COMBATCTHUD.Controls.toggle',
    icon: 'fa-solid fa-dharmachakra',
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => hud?.toggle()
  }
})

/* -------------------------------------------- */
/*  PopOut!                                     */
/* -------------------------------------------- */

// Ao destacar ou trazer de volta, re-renderiza para ajustar o layout
// (janela inteira x flutuante) e o ícone do botão.
for (const hook of ['PopOut:loaded', 'PopOut:popin']) {
  Hooks.on(hook, (app) => { if (app === hud) hud.refresh() })
}

/* -------------------------------------------- */
/*  Combate                                     */
/* -------------------------------------------- */

for (const hook of ['createCombat', 'deleteCombat', 'combatStart']) {
  Hooks.on(hook, () => {
    if (!hud) return
    hud.hiddenByUser = false
    hud.cards.seed()
  })
}

// Limpa os cards do HUD a cada nova rodada (ou turno, conforme a opção).
Hooks.on('updateCombat', (combat, changed) => {
  if (!hud || combat !== game.combat) return
  const mode = getSetting('clearCards')
  const newRound = 'round' in changed
  const newTurn = 'turn' in changed
  if ((mode === 'round' && newRound) || (mode === 'turn' && (newRound || newTurn))) {
    hud.cards.newRound()
  }
})

for (const hook of [
  'updateCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant',
  'canvasReady', 'controlToken', 'targetToken'
]) {
  Hooks.on(hook, refresh)
}

/* -------------------------------------------- */
/*  Atores (PV, condições, armas...)            */
/* -------------------------------------------- */

function isRelevantActor (actor) {
  if (!actor) return false
  if (game.combat?.combatants.some(c => c.actor === actor || c.actorId === actor.id)) return true
  return hud?.focusActor === actor
}

Hooks.on('updateActor', (actor) => { if (isRelevantActor(actor)) refresh() })
Hooks.on('updateToken', (token) => { if (isRelevantActor(token.actor)) refresh() })
for (const hook of ['createItem', 'updateItem', 'deleteItem', 'createActiveEffect', 'deleteActiveEffect']) {
  Hooks.on(hook, (doc) => { if (isRelevantActor(doc.parent)) refresh() })
}

/* -------------------------------------------- */
/*  Cards do chat                               */
/* -------------------------------------------- */

Hooks.on('createChatMessage', (message) => {
  if (hud && game.combat) hud.cards.add(message)
})
Hooks.on('updateChatMessage', (message) => hud?.cards.update(message))
Hooks.on('deleteChatMessage', (message) => hud?.cards.remove(message.id))
Hooks.on('clearChatLog', () => hud?.cards.clear())

// Opcional: esconde do chat os cards que já estão no HUD.
Hooks.on('renderChatMessageHTML', (message, html) => {
  if (!hud?.rendered || !game.combat || !getSetting('hideCardsInChat') || getSetting('maxCards') <= 0) return
  // Só esconde do chat o que este usuário também vê no HUD.
  if (!CardFeed.canShow(message) || hud.cards.dismissed.has(message.id)) return
  // Cards já no HUD ou recém-criados (que o HUD está adicionando agora).
  const isNew = Date.now() - (message.timestamp ?? 0) < 10000
  if (hud.cards.elements.has(message.id) || isNew) {
    html.classList.add('cthud-hidden-in-chat')
  }
})

import { MODULE_ID, SKINS } from './constants.js'

export function registerSettings (onChange) {
  game.settings.register(MODULE_ID, 'enabled', {
    name: 'COMBATCTHUD.Settings.enabled.name',
    hint: 'COMBATCTHUD.Settings.enabled.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange
  })

  game.settings.register(MODULE_ID, 'onlyInCombat', {
    name: 'COMBATCTHUD.Settings.onlyInCombat.name',
    hint: 'COMBATCTHUD.Settings.onlyInCombat.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange
  })

  game.settings.register(MODULE_ID, 'skin', {
    name: 'COMBATCTHUD.Settings.skin.name',
    hint: 'COMBATCTHUD.Settings.skin.hint',
    scope: 'client',
    config: true,
    type: String,
    choices: SKINS,
    default: 'noir20',
    onChange
  })

  game.settings.register(MODULE_ID, 'maxCards', {
    name: 'COMBATCTHUD.Settings.maxCards.name',
    hint: 'COMBATCTHUD.Settings.maxCards.hint',
    scope: 'client',
    config: true,
    type: Number,
    range: { min: 0, max: 10, step: 1 },
    default: 3,
    onChange
  })

  game.settings.register(MODULE_ID, 'hideCardsInChat', {
    name: 'COMBATCTHUD.Settings.hideCardsInChat.name',
    hint: 'COMBATCTHUD.Settings.hideCardsInChat.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.chat?.render()
  })

  game.settings.register(MODULE_ID, 'playersQuickDamage', {
    name: 'COMBATCTHUD.Settings.playersQuickDamage.name',
    hint: 'COMBATCTHUD.Settings.playersQuickDamage.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange
  })

  game.settings.register(MODULE_ID, 'position', {
    scope: 'client',
    config: false,
    type: Object,
    default: { left: 110, top: 70 }
  })

  game.settings.register(MODULE_ID, 'collapsed', {
    scope: 'client',
    config: false,
    type: Object,
    default: {}
  })
}

export const getSetting = (key) => game.settings.get(MODULE_ID, key)
export const setSetting = (key, value) => game.settings.set(MODULE_ID, key, value)

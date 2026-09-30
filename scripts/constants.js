export const MODULE_ID = 'combatcthud'
export const SYSTEM_ID = 'CoC7'
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`

/**
 * Tipos de card do sistema CoC7 (flags.CoC7.load.as) exibidos no HUD.
 */
export const CARD_TYPES = new Set([
  'CoC7ChatCombatMelee',
  'CoC7ChatCombatRanged',
  'CoC7ChatDamage',
  'CoC7Check',
  'CoC7ChatCombinedMessage',
  'CoC7ChatOpposedMessage',
  'CoC7ConCheck',
  'CoC7SanCheckCard'
])

/**
 * Condições do CoC7 (actor.system.conditions.<id>.value) e ícone de reserva.
 */
export const CONDITIONS = [
  { id: 'criticalWounds', icon: 'fa-solid fa-heart-crack' },
  { id: 'dying', icon: 'fa-solid fa-skull-crossbones' },
  { id: 'unconscious', icon: 'fa-solid fa-bed' },
  { id: 'prone', icon: 'fa-solid fa-person-falling' },
  { id: 'tempoInsane', icon: 'fa-solid fa-brain' },
  { id: 'indefInsane', icon: 'fa-solid fa-hurricane' },
  { id: 'dead', icon: 'fa-solid fa-skull' }
]

/**
 * Atributos exibidos como barras.
 */
export const BARS = ['hp', 'mp', 'san', 'lck']

/**
 * Skins disponíveis. Para adicionar uma nova, crie styles/skin-<id>.css
 * (veja skin-pulp.css), inclua-o em module.json > styles e registre aqui.
 */
export const SKINS = {
  noir20: 'COMBATCTHUD.Skins.noir20',
  pulp: 'COMBATCTHUD.Skins.pulp'
}

/**
 * Níveis de sucesso do CoC7 (CoC7DicePool.successLevel) usados na
 * iniciativa opcional.
 */
export const SUCCESS_LEVELS = {
  '-99': 'COMBATCTHUD.Success.fumble',
  0: 'COMBATCTHUD.Success.failure',
  1: 'COMBATCTHUD.Success.regular',
  2: 'COMBATCTHUD.Success.hard',
  3: 'COMBATCTHUD.Success.extreme',
  4: 'COMBATCTHUD.Success.critical'
}

import { BARS, CONDITIONS, SUCCESS_LEVELS, SYSTEM_ID } from './constants.js'

const BAR_MAX_FALLBACK = { lck: 99, san: 99 }

/**
 * Monta as barras PV / PM / SAN / Sorte de um ator CoC7.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function getBars (actor) {
  const attribs = actor?.system?.attribs
  if (!attribs) return []
  const bars = []
  for (const key of BARS) {
    const attr = attribs[key]
    if (!attr || attr.value === null || attr.value === undefined) continue
    const value = Number(attr.value) || 0
    const max = Number(attr.max) || BAR_MAX_FALLBACK[key] || Math.max(value, 1)
    bars.push({
      key,
      label: game.i18n.localize(`COMBATCTHUD.Bars.${key}`),
      title: game.i18n.localize(`COMBATCTHUD.Bars.${key}Long`),
      value,
      max,
      pct: Math.clamp(Math.round((value / max) * 100), 0, 100)
    })
  }
  return bars
}

/**
 * Condições do ator com o ícone registrado pelo sistema (CONFIG.statusEffects).
 * @param {Actor} actor
 * @returns {object[]}
 */
export function getConditions (actor) {
  const conditions = actor?.system?.conditions
  if (!conditions) return []
  return CONDITIONS
    .filter(c => conditions[c.id] !== undefined)
    .map(c => {
      const effect = CONFIG.statusEffects.find(e => e.id === c.id)
      return {
        id: c.id,
        active: !!conditions[c.id]?.value,
        img: effect?.img ?? effect?.icon ?? null,
        icon: c.icon,
        label: game.i18n.localize(`COMBATCTHUD.Conditions.${c.id}`)
      }
    })
}

/**
 * Armas do ator com valor de perícia e dano.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function getWeapons (actor) {
  if (!actor) return []
  return actor.items
    .filter(i => i.type === 'weapon')
    .map(w => {
      const skill = actor.items.get(w.system.skill?.main?.id)
      const bullets = parseInt(w.system.bullets ?? 0, 10) || 0
      const ammo = parseInt(w.system.ammo ?? 0, 10) || 0
      return {
        id: w.id,
        name: w.name,
        img: w.img,
        ranged: !!w.system.properties?.rngd,
        skill: skill?.system?.value ?? null,
        damage: w.system.range?.normal?.damage ?? '',
        // Armas com capacidade (system.bullets) têm munição (system.ammo).
        reloadable: bullets > 0,
        bullets,
        ammo,
        full: ammo >= bullets
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Perícias de combate: Esquivar + Lutar (todas as especializações).
 * @param {Actor} actor
 * @returns {object[]}
 */
export function getCombatSkills (actor) {
  if (!actor) return []
  const skills = []
  const dodge = actor.getFirstItemByCoCID?.('i.skill.dodge') ??
    actor.items.find(i => i.type === 'skill' && /dodge|esquiv/i.test(i.name))
  if (dodge) skills.push(toSkill(dodge, 'fa-solid fa-person-running'))
  actor.items
    .filter(i => i.type === 'skill' && i.system.properties?.fighting)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => skills.push(toSkill(s, 'fa-solid fa-hand-fist')))
  return skills
}

function toSkill (item, icon) {
  return {
    uuid: item.uuid,
    name: item.system.skillName || item.name,
    value: item.system.value,
    icon
  }
}

/**
 * Texto da iniciativa, respeitando a regra opcional do CoC7 (nível de sucesso).
 * @param {number|null} initiative
 * @returns {string}
 */
export function formatInitiative (initiative) {
  if (initiative === null || initiative === undefined) return '—'
  let rule = 'basic'
  try { rule = game.settings.get(SYSTEM_ID, 'initiativeRule') } catch (e) {}
  if (rule === 'optional') {
    const level = Math.floor(initiative)
    const key = SUCCESS_LEVELS[level]
    if (key) return game.i18n.localize(key)
  }
  return String(Math.floor(initiative))
}

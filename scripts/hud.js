import { MODULE_ID, TEMPLATE_PATH } from './constants.js'
import { formatInitiative, getBars, getCombatSkills, getConditions, getWeapons } from './actor-data.js'
import { CardFeed } from './cards.js'
import { getSetting, setSetting } from './settings.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class CombatCthulhuHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'combatcthud',
    classes: ['combatcthud'],
    tag: 'section',
    window: {
      frame: false,
      positioned: true
    },
    position: {
      width: 'auto',
      height: 'auto'
    },
    // O PopOut! não põe o botão dele (o HUD não tem barra de título); o HUD
    // tem um botão próprio que usa a API do PopOut!.
    popOutModuleDisable: true,
    actions: {
      cthudPopout: CombatCthulhuHUD.#onPopout,
      cthudToggleSection: CombatCthulhuHUD.#onToggleSection,
      cthudHide: CombatCthulhuHUD.#onHide,
      cthudPreviousTurn: CombatCthulhuHUD.#onPreviousTurn,
      cthudNextTurn: CombatCthulhuHUD.#onNextTurn,
      cthudNextRound: CombatCthulhuHUD.#onNextRound,
      cthudStartCombat: CombatCthulhuHUD.#onStartCombat,
      cthudEndCombat: CombatCthulhuHUD.#onEndCombat,
      cthudRollInitiative: CombatCthulhuHUD.#onRollInitiative,
      cthudToggleGun: CombatCthulhuHUD.#onToggleGun,
      cthudWeapon: CombatCthulhuHUD.#onWeapon,
      cthudReload: CombatCthulhuHUD.#onReload,
      cthudSkill: CombatCthulhuHUD.#onSkill,
      cthudLuck: CombatCthulhuHUD.#onLuck,
      cthudCondition: CombatCthulhuHUD.#onCondition,
      cthudOpenSheet: CombatCthulhuHUD.#onOpenSheet,
      cthudDamage: CombatCthulhuHUD.#onDamage,
      cthudClearCards: CombatCthulhuHUD.#onClearCards
    }
  }

  static PARTS = {
    hud: { template: `${TEMPLATE_PATH}/hud.hbs` }
  }

  /** O usuário escondeu o HUD manualmente (atalho / botão). */
  hiddenByUser = false

  constructor (options) {
    super(options)
    this.cards = new CardFeed(() => this.refresh())
    this.refresh = foundry.utils.debounce(this.#refresh.bind(this), 50)
  }

  /* -------------------------------------------- */
  /*  Visibilidade                                */
  /* -------------------------------------------- */

  get shouldShow () {
    if (!getSetting('enabled') || this.hiddenByUser) return false
    if (getSetting('onlyInCombat')) return !!game.combat
    return true
  }

  #refresh () {
    if (this.shouldShow) this.render({ force: true })
    else if (this.rendered) this.close({ animate: false })
  }

  /* -------------------------------------------- */
  /*  PopOut! (módulo "popout")                   */
  /* -------------------------------------------- */

  /** API do PopOut!, se o módulo estiver ativo. */
  static get popoutApi () {
    if (!game.modules.get('popout')?.active) return null
    // eslint-disable-next-line no-undef
    return typeof PopoutModule !== 'undefined' ? PopoutModule : null
  }

  /** Janela do PopOut! onde o HUD está, se estiver destacado. */
  get popoutWindow () {
    const win = CombatCthulhuHUD.popoutApi?.singleton?.poppedOut?.get(this.id)?.window
    return win && !win.closed ? win : null
  }

  get isPoppedOut () {
    return !!this.popoutWindow
  }

  /** Destaca o HUD numa janela separada, ou traz de volta. */
  togglePopout () {
    const api = CombatCthulhuHUD.popoutApi
    if (!api || !this.rendered) return
    const win = this.popoutWindow
    if (win) {
      // Mesmo caminho do botão "Pop In" do PopOut!: fecha a janela e
      // re-renderiza o HUD na janela principal.
      win._popout_dont_close = true
      win.close()
    } else {
      api.popoutApp(this)
    }
  }

  toggle () {
    this.hiddenByUser = !this.hiddenByUser
    if (!this.hiddenByUser && !getSetting('enabled')) setSetting('enabled', true)
    this.refresh()
  }

  /* -------------------------------------------- */
  /*  Dados                                       */
  /* -------------------------------------------- */

  /**
   * Ator em foco no painel: o combatente do turno se o usuário for dono,
   * senão o token controlado, o personagem do jogador ou o primeiro
   * combatente que ele controla.
   */
  get focusActor () {
    const combat = game.combat
    const current = combat?.combatant
    if (current?.actor?.isOwner) return current.actor
    const controlled = canvas.tokens?.controlled?.find(t => t.actor?.isOwner)?.actor
    if (controlled) return controlled
    if (game.user.character) return game.user.character
    return combat?.combatants.find(c => c.actor?.isOwner && c.hasPlayerOwner)?.actor ?? null
  }

  get focusCombatant () {
    const actor = this.focusActor
    if (!actor || !game.combat) return null
    return game.combat.combatants.find(c => c.actor === actor) ??
      game.combat.getCombatantsByActor?.(actor)?.[0] ?? null
  }

  get canQuickDamage () {
    return game.user.isGM || getSetting('playersQuickDamage')
  }

  async _prepareContext (options) {
    const combat = game.combat
    const collapsed = getSetting('collapsed') ?? {}
    const actor = this.focusActor
    const combatant = this.focusCombatant
    const isGM = game.user.isGM

    const turns = (combat?.turns ?? [])
      .filter(c => c.visible)
      .map(c => {
        const token = c.token?.object
        // PV: o mestre vê todos; o jogador só vê os atores que controla.
        const showHp = isGM || !!c.actor?.isOwner
        const hp = c.actor?.system?.attribs?.hp
        return {
          id: c.id,
          name: c.name,
          img: c.img || c.token?.texture?.src || c.actor?.img,
          initiative: formatInitiative(c.initiative),
          hasInitiative: c.initiative !== null,
          active: combat.combatant?.id === c.id,
          defeated: c.isDefeated,
          hidden: c.hidden,
          owner: c.isOwner,
          targeted: !!token?.isTargeted,
          hasGun: !!c.getFlag('CoC7', 'hasGun'),
          hpPct: showHp && hp?.max ? Math.clamp(Math.round((hp.value / hp.max) * 100), 0, 100) : null
        }
      })

    const current = combat?.combatant
    return {
      skin: getSetting('skin'),
      isGM,
      collapsed,
      combat: combat
        ? {
            started: combat.started,
            round: combat.round,
            turns,
            currentName: current?.visible ? current.name : null,
            canEndTurn: combat.started && !!current?.isOwner
          }
        : null,
      actor: actor
        ? {
            name: actor.name,
            img: actor.img,
            bars: getBars(actor),
            conditions: getConditions(actor),
            weapons: getWeapons(actor),
            skills: getCombatSkills(actor),
            isTurn: !!current && current.actor === actor,
            combatant: combatant
              ? {
                  id: combatant.id,
                  hasInitiative: combatant.initiative !== null,
                  hasGun: !!combatant.getFlag('CoC7', 'hasGun')
                }
              : null
          }
        : null,
      damage: this.canQuickDamage
        ? { targets: this.#damageTargets().map(a => a.name) }
        : null,
      popout: CombatCthulhuHUD.popoutApi
        ? { active: this.isPoppedOut }
        : null,
      cardCount: this.cards.order.length,
      showCards: getSetting('maxCards') > 0
    }
  }

  /* -------------------------------------------- */
  /*  Renderização                                */
  /* -------------------------------------------- */

  _preRender (context, options) {
    this._cardScroll = this.element?.querySelector('.cthud-cards')?.scrollTop ?? 0
    return super._preRender(context, options)
  }

  async _onRender (context, options) {
    await super._onRender(context, options)
    const el = this.element
    for (const cls of [...el.classList]) if (cls.startsWith('skin-')) el.classList.remove(cls)
    el.classList.add(`skin-${context.skin}`)
    el.classList.toggle('cthud-popped', this.isPoppedOut)

    // Cards do sistema: reaproveita os elementos já renderizados.
    const list = el.querySelector('.cthud-card-list')
    if (list) {
      list.replaceChildren(...this.cards.list)
      const scroller = el.querySelector('.cthud-cards')
      if (scroller) scroller.scrollTop = this._cardScroll ?? 0
      // Expandir/recolher rolagens (no chat isso é feito pelo ChatLog).
      list.addEventListener('click', (event) => {
        const roll = event.target.closest('[data-action="expandRoll"]')
        if (roll && list.contains(roll)) {
          event.preventDefault()
          roll.classList.toggle('expanded')
        }
      })
    }

    // Botão direito no recarregar: gasta/remove uma bala.
    el.querySelectorAll('.cthud-reload').forEach(btn => {
      btn.addEventListener('contextmenu', async (event) => {
        event.preventDefault()
        const weapon = this.focusActor?.items.get(btn.dataset.itemId)
        if (weapon?.isOwner) await weapon.system.shootAmmunition(1)
      })
    })

    // Numa janela do PopOut! o HUD ocupa a janela toda: sem arrastar.
    if (!this.isPoppedOut) this.#bindDrag()
    this.#bindInitiative()
  }

  _onFirstRender (context, options) {
    super._onFirstRender?.(context, options)
    const pos = getSetting('position') ?? {}
    const left = Math.clamp(pos.left ?? 110, 0, Math.max(window.innerWidth - 200, 0))
    const top = Math.clamp(pos.top ?? 70, 0, Math.max(window.innerHeight - 80, 0))
    this.setPosition({ left, top })
  }

  #bindDrag () {
    const handle = this.element.querySelector('.cthud-drag')
    if (!handle) return
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button, a, input')) return
      event.preventDefault()
      const start = { x: event.clientX, y: event.clientY, left: this.position.left, top: this.position.top }
      const move = (ev) => {
        this.setPosition({
          left: Math.max(0, start.left + ev.clientX - start.x),
          top: Math.max(0, start.top + ev.clientY - start.y)
        })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setSetting('position', { left: this.position.left, top: this.position.top })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }

  /**
   * Retratos da iniciativa: clique = alvo (Shift mantém outros alvos),
   * duplo clique = centralizar no token, botão direito = abrir ficha.
   */
  #bindInitiative () {
    this.element.querySelectorAll('.cthud-combatant').forEach(li => {
      const combatant = game.combat?.combatants.get(li.dataset.combatantId)
      if (!combatant) return
      li.addEventListener('click', (event) => {
        if (event.target.closest('button')) return
        const token = combatant.token?.object
        if (!token) return
        token.setTarget(!token.isTargeted, { releaseOthers: !event.shiftKey })
      })
      li.addEventListener('dblclick', () => {
        const token = combatant.token?.object
        if (token) canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 })
      })
      li.addEventListener('contextmenu', (event) => {
        event.preventDefault()
        if (combatant.actor?.isOwner) combatant.actor.sheet.render({ force: true })
      })
    })
  }

  /* -------------------------------------------- */
  /*  Ações                                       */
  /* -------------------------------------------- */

  static async #onToggleSection (event, target) {
    const section = target.dataset.section
    const collapsed = foundry.utils.deepClone(getSetting('collapsed') ?? {})
    collapsed[section] = !collapsed[section]
    await setSetting('collapsed', collapsed)
    this.render()
  }

  static #onPopout () {
    this.togglePopout()
  }

  static #onHide () {
    this.toggle()
    ui.notifications.info('COMBATCTHUD.Notify.hidden', { localize: true })
  }

  static #onPreviousTurn () { return game.combat?.previousTurn() }
  static #onNextTurn () { return game.combat?.nextTurn() }
  static #onNextRound () { return game.combat?.nextRound() }
  static #onStartCombat () { return game.combat?.startCombat() }
  static #onEndCombat () { return game.combat?.endCombat() }

  static #onRollInitiative (event, target) {
    const id = target.dataset.combatantId
    if (id) return game.combat?.rollInitiative([id])
  }

  /** Mesmo comportamento do botão de revólver do Combat Tracker do CoC7. */
  static async #onToggleGun (event, target) {
    const combatant = game.combat?.combatants.get(target.dataset.combatantId)
    if (!combatant?.actor?.isOwner) return
    const hasGun = !combatant.getFlag('CoC7', 'hasGun')
    await combatant.setFlag('CoC7', 'hasGun', hasGun)
    const newInit = await combatant.actor.rollInitiative(hasGun)
    if (!hasGun || combatant.initiative === null || combatant.initiative < newInit) {
      await game.combat.setInitiative(combatant.id, newInit)
    }
  }

  static #onWeapon (event, target) {
    const actor = this.focusActor
    if (!actor) return
    actor.weaponCheck({ id: target.dataset.itemId }, event.shiftKey)
  }

  /**
   * Recarregar arma (mesma lógica da ficha do CoC7):
   * clique = pente cheio · Shift+clique = +1 bala · botão direito = −1 bala.
   */
  static async #onReload (event, target) {
    const actor = this.focusActor
    const weapon = actor?.items.get(target.dataset.itemId)
    if (!weapon?.isOwner || weapon.type !== 'weapon') return
    if (event.shiftKey) return weapon.system.addAmmunition()
    const before = parseInt(weapon.system.ammo ?? 0, 10) || 0
    const max = parseInt(weapon.system.bullets ?? 0, 10) || 0
    if (before >= max) {
      ui.notifications.info(game.i18n.format('COMBATCTHUD.Reload.alreadyFull', { weapon: weapon.name }))
      return
    }
    await weapon.system.reload()
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><i class="fa-solid fa-rotate-right"></i> ${game.i18n.format('COMBATCTHUD.Reload.done', { name: actor.name, weapon: weapon.name, ammo: max, bullets: max })}</p>`
    })
  }

  static #onSkill (event, target) {
    const actor = this.focusActor
    if (!actor) return
    actor.skillCheck(target.dataset.uuid, event.shiftKey)
  }

  static #onLuck (event) {
    this.focusActor?.attributeCheck('lck', event.shiftKey)
  }

  static #onCondition (event, target) {
    const actor = this.focusActor
    if (!actor?.isOwner) return
    actor.toggleCondition(target.dataset.condition)
  }

  static #onOpenSheet () {
    this.focusActor?.sheet.render({ force: true })
  }

  static #onClearCards () {
    this.cards.clear()
  }

  /**
   * Dano rápido: aplica nos alvos do usuário (ou no ator em foco).
   * mode = damage (com armadura) | direct (ignora armadura) | heal
   */
  static async #onDamage (event, target) {
    if (!this.canQuickDamage) return
    const input = this.element.querySelector('input[name="cthud-damage"]')
    const formula = input?.value?.trim()
    if (!formula) {
      ui.notifications.warn('COMBATCTHUD.Damage.empty', { localize: true })
      return input?.focus()
    }
    let amount
    try {
      const roll = await new Roll(formula).evaluate()
      amount = Math.max(0, Math.floor(roll.total))
      if (!roll.isDeterministic) {
        await roll.toMessage({
          flavor: game.i18n.localize('COMBATCTHUD.Damage.rollFlavor'),
          speaker: ChatMessage.getSpeaker({ user: game.user })
        }, { rollMode: game.user.isGM ? CONST.DICE_ROLL_MODES.PRIVATE : CONST.DICE_ROLL_MODES.PUBLIC })
      }
    } catch (err) {
      ui.notifications.error(game.i18n.format('COMBATCTHUD.Damage.invalid', { formula }))
      return
    }

    const mode = target.dataset.mode
    const actors = this.#damageTargets()
    if (!actors.length) {
      ui.notifications.warn('COMBATCTHUD.Damage.noTarget', { localize: true })
      return
    }
    const lines = []
    for (const actor of actors) {
      if (!actor.isOwner) {
        ui.notifications.warn(game.i18n.format('COMBATCTHUD.Damage.notOwner', { name: actor.name }))
        continue
      }
      const before = Number(actor.system.attribs?.hp?.value ?? 0)
      try {
        if (mode === 'heal') {
          await actor.setHp(before + amount)
        } else {
          await actor.dealDamage(amount, { ignoreArmor: mode === 'direct' })
        }
      } catch (err) {
        console.error('combatcthud | falha ao aplicar dano', err)
        continue
      }
      const after = Number(actor.system.attribs?.hp?.value ?? 0)
      const key = mode === 'heal' ? 'COMBATCTHUD.Damage.healed' : 'COMBATCTHUD.Damage.dealt'
      lines.push({ actor, text: game.i18n.format(key, { name: actor.name, value: Math.abs(after - before), hp: after, max: actor.system.attribs?.hp?.max ?? '?' }) })
    }
    if (!lines.length) return
    // Cada resultado (com PV) vai só para o mestre e para os donos do ator.
    for (const { actor, text } of lines) {
      const whisper = game.users
        .filter(u => u.isGM || actor.testUserPermission(u, 'OWNER'))
        .map(u => u.id)
      await ChatMessage.create({ content: `<p>${text}</p>`, speaker: ChatMessage.getSpeaker({ user: game.user }), whisper })
    }
    if (input) input.value = ''
  }

  #damageTargets () {
    const targets = [...game.user.targets].map(t => t.actor).filter(Boolean)
    if (targets.length) return targets
    const actor = this.focusActor
    return actor ? [actor] : []
  }
}

import { CARD_TYPES, SYSTEM_ID } from './constants.js'
import { getSetting } from './settings.js'

/** Tipos de rolagem do Foundry (CONFIG.Dice.rollModes). */
export const ROLL_MODES = {
  public: 'publicroll',
  private: 'gmroll',
  blind: 'blindroll',
  self: 'selfroll'
}

const MODE_BADGES = {
  [ROLL_MODES.private]: { icon: 'fa-solid fa-user-secret', label: 'COMBATCTHUD.RollModes.private' },
  [ROLL_MODES.blind]: { icon: 'fa-solid fa-eye-slash', label: 'COMBATCTHUD.RollModes.blind' },
  [ROLL_MODES.self]: { icon: 'fa-solid fa-user', label: 'COMBATCTHUD.RollModes.self' }
}

/**
 * Mantém os cards originais do CoC7 renderizados para o HUD.
 *
 * Cada card é gerado com ChatMessage#renderHTML(), que dispara o hook
 * `renderChatMessageHTML`. É nesse hook que o CoC7 liga os botões dos cards
 * (esquivar, revidar, rolar dano, gastar sorte...), então o elemento que o HUD
 * exibe é tão funcional quanto o do chat.
 *
 * O HUD respeita o tipo de rolagem de cada card:
 *   - pública: todos veem, com os resultados dos dados abertos;
 *   - privada (mestre): só o mestre e quem rolou;
 *   - cega: o mestre vê tudo; quem rolou vê o card sem os resultados;
 *   - só para mim: só quem rolou.
 */
export class CardFeed {
  /** @type {string[]} ids das mensagens, mais recente primeiro */
  order = []
  /** @type {Map<string, HTMLElement>} */
  elements = new Map()
  /** @type {Set<string>} cards dispensados pelo usuário */
  dismissed = new Set()
  /** Cards anteriores a este instante (ms) já foram limpos (nova rodada). */
  since = 0

  constructor (onChange) {
    this.onChange = onChange
  }

  static isRelevant (message) {
    const as = message?.flags?.[SYSTEM_ID]?.load?.as
    return !!as && CARD_TYPES.has(as)
  }

  /**
   * Tipo de rolagem do card. O CoC7 grava o modo em alguns cards
   * (flags.CoC7.load.rollMode); nos demais, deduz de blind/whisper.
   * @param {ChatMessage} message
   * @returns {string} um valor de ROLL_MODES
   */
  static rollMode (message) {
    const flag = message.flags?.[SYSTEM_ID]?.load?.rollMode
    if (Object.values(ROLL_MODES).includes(flag)) return flag
    if (message.blind) return ROLL_MODES.blind
    const whisper = message.whisper ?? []
    if (!whisper.length) return ROLL_MODES.public
    const authorId = message.author?.id ?? message.user?.id
    if (whisper.length === 1 && whisper[0] === authorId) return ROLL_MODES.self
    return ROLL_MODES.private
  }

  /**
   * O que o usuário atual pode ver deste card no HUD.
   * @param {ChatMessage} message
   * @returns {{show: boolean, masked: boolean, mode: string}}
   */
  static visibility (message) {
    const mode = CardFeed.rollMode(message)
    const hidden = { show: false, masked: false, mode }
    if (!message.visible) return hidden
    const isAuthor = message.isAuthor ?? (message.author?.id === game.user.id)
    const whispered = (message.whisper ?? []).includes(game.user.id)
    // "Só para mim": quem rolou (e quem o CoC7 incluiu no sussurro); nem o
    // mestre vê, como no chat.
    if (mode === ROLL_MODES.self) return (isAuthor || whispered) ? { show: true, masked: false, mode } : hidden
    if (game.user.isGM) return { show: true, masked: false, mode }
    switch (mode) {
      case ROLL_MODES.public:
        return { show: true, masked: false, mode }
      case ROLL_MODES.private:
        return (isAuthor || whispered) ? { show: true, masked: false, mode } : hidden
      case ROLL_MODES.blind:
        return isAuthor ? { show: true, masked: true, mode } : hidden
    }
    return hidden
  }

  static canShow (message) {
    return CardFeed.isRelevant(message) && CardFeed.visibility(message).show
  }

  get max () {
    return getSetting('maxCards')
  }

  /**
   * Recarrega os cards do combate atual (desde a última limpeza).
   */
  async seed () {
    this.order = []
    this.elements.clear()
    const combat = game.combat
    if (!combat || this.max <= 0) return this.onChange()
    const since = Math.max(combat._stats?.createdTime ?? 0, this.since)
    const messages = game.messages.contents
      .filter(m => CardFeed.canShow(m) && (m.timestamp ?? 0) >= since && !this.dismissed.has(m.id))
      .slice(-this.max)
      .reverse()
    for (const message of messages) {
      const el = await this.#render(message)
      if (!el) continue
      this.order.push(message.id)
      this.elements.set(message.id, el)
    }
    this.onChange()
  }

  async add (message) {
    if (!CardFeed.canShow(message) || this.max <= 0) return
    const el = await this.#render(message)
    if (!el) return
    this.order = [message.id, ...this.order.filter(id => id !== message.id)]
    this.elements.set(message.id, el)
    this.#trim()
    this.onChange()
  }

  async update (message) {
    if (!this.elements.has(message.id)) return
    if (!CardFeed.canShow(message)) return this.remove(message.id)
    const el = await this.#render(message)
    if (!el) return
    const old = this.elements.get(message.id)
    this.elements.set(message.id, el)
    // Substitui no lugar para não re-renderizar o HUD inteiro.
    if (old?.isConnected) old.replaceWith(el)
    else this.onChange()
  }

  /**
   * Volta a exibir no chat um card que saiu do HUD (opção "esconder do chat").
   */
  static unhideInChat (id) {
    document.querySelectorAll(`.chat-message[data-message-id="${id}"].cthud-hidden-in-chat`)
      .forEach(el => el.classList.remove('cthud-hidden-in-chat'))
  }

  remove (id) {
    CardFeed.unhideInChat(id)
    if (!this.elements.has(id)) return
    this.elements.get(id)?.remove()
    this.elements.delete(id)
    this.order = this.order.filter(o => o !== id)
    this.onChange()
  }

  dismiss (id) {
    this.dismissed.add(id)
    this.remove(id)
  }

  clear () {
    this.order.forEach(id => CardFeed.unhideInChat(id))
    this.order = []
    this.elements.clear()
    this.dismissed.clear()
    this.onChange()
  }

  /**
   * Nova rodada (ou turno): tira do HUD os cards anteriores. No chat eles
   * continuam todos.
   */
  newRound () {
    this.since = Date.now()
    this.clear()
  }

  /** @returns {HTMLElement[]} */
  get list () {
    return this.order.map(id => this.elements.get(id)).filter(Boolean)
  }

  #trim () {
    while (this.order.length > this.max) {
      const id = this.order.pop()
      CardFeed.unhideInChat(id)
      this.elements.get(id)?.remove()
      this.elements.delete(id)
    }
  }

  async #render (message) {
    try {
      const { masked, mode } = CardFeed.visibility(message)
      let el
      if (typeof message.renderHTML === 'function') {
        el = await message.renderHTML({ canDelete: false, canClose: false })
      } else {
        el = (await message.getHTML())?.[0]
      }
      if (!el) return null
      el.classList.remove('cthud-hidden-in-chat')
      el.classList.add('cthud-card', `cthud-mode-${mode}`)
      el.dataset.cthudMessageId = message.id

      if (masked) {
        // Rolagem cega vista por quem rolou: some com os resultados.
        el.classList.add('cthud-masked')
        el.querySelectorAll('.dice-tooltip, .dice-result .part-total').forEach(e => e.remove())
        el.querySelectorAll('.dice-total').forEach(e => {
          if (/^\s*-?\d+\s*$/.test(e.textContent)) e.textContent = '?'
        })
      } else {
        // Resultados visíveis para este usuário: deixa os dados abertos.
        el.querySelectorAll('.dice-roll:not(.never-expand)').forEach(r => r.classList.add('expanded'))
      }

      const badge = MODE_BADGES[mode]
      if (badge) {
        const tag = document.createElement('span')
        tag.className = `cthud-roll-mode cthud-roll-mode-${mode}`
        tag.innerHTML = `<i class="${badge.icon}"></i> ${game.i18n.localize(badge.label)}`
        el.prepend(tag)
      }

      const dismiss = document.createElement('button')
      dismiss.type = 'button'
      dismiss.className = 'cthud-card-dismiss'
      dismiss.dataset.tooltip = game.i18n.localize('COMBATCTHUD.Cards.dismiss')
      dismiss.innerHTML = '<i class="fa-solid fa-xmark"></i>'
      dismiss.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        this.dismiss(message.id)
      })
      el.prepend(dismiss)
      return el
    } catch (err) {
      console.error('combatcthud | falha ao renderizar card', message, err)
      return null
    }
  }
}

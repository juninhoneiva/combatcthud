import { CARD_TYPES, SYSTEM_ID } from './constants.js'
import { getSetting } from './settings.js'

/**
 * Mantém os cards originais do CoC7 renderizados para o HUD.
 *
 * Cada card é gerado com ChatMessage#renderHTML(), que dispara o hook
 * `renderChatMessageHTML`. É nesse hook que o CoC7 liga os botões dos cards
 * (esquivar, revidar, rolar dano, gastar sorte...), então o elemento que o HUD
 * exibe é tão funcional quanto o do chat.
 */
export class CardFeed {
  /** @type {string[]} ids das mensagens, mais recente primeiro */
  order = []
  /** @type {Map<string, HTMLElement>} */
  elements = new Map()
  /** @type {Set<string>} cards dispensados pelo usuário */
  dismissed = new Set()

  constructor (onChange) {
    this.onChange = onChange
  }

  static isRelevant (message) {
    const as = message?.flags?.[SYSTEM_ID]?.load?.as
    return !!as && CARD_TYPES.has(as)
  }

  get max () {
    return getSetting('maxCards')
  }

  /**
   * Recarrega os cards criados desde o início do combate atual.
   */
  async seed () {
    this.order = []
    this.elements.clear()
    const combat = game.combat
    if (!combat || this.max <= 0) return this.onChange()
    const since = combat._stats?.createdTime ?? 0
    const messages = game.messages.contents
      .filter(m => CardFeed.isRelevant(m) && m.visible && (m.timestamp ?? 0) >= since && !this.dismissed.has(m.id))
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
    if (!CardFeed.isRelevant(message) || !message.visible || this.max <= 0) return
    const el = await this.#render(message)
    if (!el) return
    this.order = [message.id, ...this.order.filter(id => id !== message.id)]
    this.elements.set(message.id, el)
    this.#trim()
    this.onChange()
  }

  async update (message) {
    if (!this.elements.has(message.id)) return
    if (!message.visible) return this.remove(message.id)
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
      let el
      if (typeof message.renderHTML === 'function') {
        el = await message.renderHTML({ canDelete: false, canClose: false })
      } else {
        el = (await message.getHTML())?.[0]
      }
      if (!el) return null
      el.classList.remove('cthud-hidden-in-chat')
      el.classList.add('cthud-card')
      el.dataset.cthudMessageId = message.id

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

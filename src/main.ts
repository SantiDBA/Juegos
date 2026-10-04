import { GAMES, type Game } from './games'

const grid = document.getElementById('grid') as HTMLElement
const countLabel = document.getElementById('count-label') as HTMLElement

/**
 * Récord de un juego, o null.
 *
 * Cada juego guarda lo suyo bajo su propia clave (`coho.bestTime.enemies`), así
 * el menú sólo las lee: no conoce el formato, sólo prueba si hay un número.
 */
function readBest(key: string | undefined): number | null {
  if (!key) return null
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function card(game: Game): HTMLElement {
  const el = document.createElement('article')
  el.className = 'card'
  el.style.setProperty('--from', game.colors.from)
  el.style.setProperty('--to', game.colors.to)
  el.style.setProperty('--accent', game.colors.accent)

  const best = readBest(game.bestKey)

  // Tarjeta entera navegable: el <a> envuelve todo, así se abre con clic,
  // con Enter y con el teclado sin handlers extra.
  const link = document.createElement('a')
  link.className = 'card-link'
  link.href = `/games/${game.id}/`
  if (game.status !== 'ready') {
    link.setAttribute('aria-disabled', 'true')
    link.dataset.wip = 'true'
  }

  const art = document.createElement('div')
  art.className = 'art'
  const glyph = document.createElement('span')
  glyph.className = 'glyph'
  glyph.textContent = game.glyph
  art.appendChild(glyph)

  const body = document.createElement('div')
  body.className = 'body'

  const top = document.createElement('div')
  top.className = 'top'
  const title = document.createElement('h2')
  title.textContent = game.title
  top.appendChild(title)

  if (game.status === 'wip') {
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = 'en curso'
    top.appendChild(badge)
  } else if (best !== null) {
    const badge = document.createElement('span')
    badge.className = 'badge best'
    badge.textContent = `récord ${best.toFixed(2)}s`
    top.appendChild(badge)
  }

  const tagline = document.createElement('p')
  tagline.className = 'tagline'
  tagline.textContent = game.tagline

  const tags = document.createElement('ul')
  tags.className = 'tags'
  for (const t of game.tags) {
    const li = document.createElement('li')
    li.textContent = t
    tags.appendChild(li)
  }

  body.append(top, tagline, tags)
  link.append(art, body)
  el.appendChild(link)
  return el
}

function render(): void {
  grid.replaceChildren(...GAMES.map(card))
  const n = GAMES.length
  countLabel.textContent = n === 1 ? '1 juego' : `${n} juegos`
}

render()
import './canvas.scss'

// ?story=<id> — одна история (пустое значение — первая); &state=<n> — одно её состояние (так их
// открывает оболочка ui.html). Номер состояния — порядок в разметке истории, с нуля.
const params = new URLSearchParams(window.location.search)
const story =
	params.get('story') === ''
		? document.querySelector('[data-story]')?.dataset.story
		: params.get('story')
let state = params.get('state')

for (const el of document.querySelectorAll('[data-story]')) {
	el.querySelectorAll('[data-state-label]').forEach((node, index) => {
		node.dataset.stateIndex = String(index)
	})
}

// Без номера состояния — первое показываемое (у неприменимых только пояснение), а не все разом
if (story && state === null) {
	const first = document.querySelector(
		`[data-story="${CSS.escape(story)}"] [data-state-label]:not([data-state-note])`
	)
	if (first) state = first.dataset.stateIndex
}

if (story) {
	document.documentElement.classList.add('is-single-story')
	for (const el of document.querySelectorAll('[data-story]')) {
		el.hidden = el.dataset.story !== story
	}
}

if (story && state !== null) {
	document.documentElement.classList.add('is-single-state')
	const current = document.querySelector(`[data-story="${CSS.escape(story)}"]`)
	for (const node of current?.querySelectorAll('[data-state-label]') || []) {
		node.hidden = node.dataset.stateIndex !== state
	}
}

const el = (tag, className, text) => {
	const node = document.createElement(tag)
	node.className = className
	if (text) node.textContent = text
	return node
}

// Цвета: имена приходят из canvas.scss (--token-colors), значение — из итогового цвета (#rrggbb)
const toHex = (value) =>
	`#${(value.match(/\d+/g) || [])
		.slice(0, 3)
		.map((v) => Number(v).toString(16).padStart(2, '0'))
		.join('')}`

function renderColors(list) {
	const names = getComputedStyle(document.documentElement)
		.getPropertyValue('--token-colors')
		.trim()
		.replace(/^["']|["']$/g, '')
		.split(/\s+/)
		.filter(Boolean)
	list.replaceChildren(
		...names.map((name) => {
			const item = el('figure', `token-swatch token-swatch--${name}`)
			const chip = el('div', 'token-swatch__chip')
			const body = el('figcaption', 'token-swatch__body')
			item.append(chip, body)
			return item
		})
	)
	// Значение считается по реальному цвету, поэтому узлы уже в DOM
	for (const item of list.children) {
		const name = item.className.match(/token-swatch--(\S+)/)[1]
		const value = toHex(getComputedStyle(item.firstChild).backgroundColor)
		item.lastChild.append(
			el('span', 'token-swatch__name', name),
			el('span', 'token-swatch__value', value)
		)
	}
}

// Иконки: спрайт ЛК вставляет скрипт сборки (virtual:svg-icons-register) — берём символы из него
function renderIcons(list) {
	const symbols = [...document.querySelectorAll('#svg-icon-sprite symbol[id^="icon-"]')]
	list.replaceChildren(
		...symbols.map((symbol) => {
			const name = symbol.id.replace(/^icon-/, '')
			const item = el('figure', 'token-icon')
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
			svg.setAttribute('aria-hidden', 'true')
			svg.setAttribute('class', 'token-icon__svg')
			const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
			use.setAttribute('href', `#${symbol.id}`)
			svg.append(use)
			item.append(svg, el('figcaption', 'token-icon__name', name))
			return item
		})
	)
}

function renderTokens() {
	for (const list of document.querySelectorAll('[data-token-list="colors"]')) renderColors(list)
	for (const list of document.querySelectorAll('[data-icon-list]')) renderIcons(list)
}

// Спрайт появляется после загрузки модулей — рисуем по load
if (document.readyState === 'complete') renderTokens()
else window.addEventListener('load', renderTokens, { once: true })

// Правка _vars.scss в dev обновляет только CSS — перерисовываем списки
if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', renderTokens)

// История «Уведомления»: вызов как у бэка — событие toast:show
document.addEventListener('click', (event) => {
	const button = event.target.closest('[data-demo-toast]')
	if (!button) return
	const { demoToast: type, demoToastText: text } = button.dataset
	document.dispatchEvent(new CustomEvent('toast:show', { detail: { type, text } }))
})

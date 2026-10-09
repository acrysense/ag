import { announce } from '@/utils/announce'
import { createIcon as icon } from '@/utils/icon'

// Подсказки поиска по Помощи (контракт — docs/bitrix/HELP.md).
// - С 2-го символа, через 300 мс после ввода, прошлый запрос отменяется; до 5 подсказок.
// - Запрос: suggestUrl?q=…&<скрытые поля формы> → { count, items: [{ type, titleHtml | title, meta,
//   url }] }; type: article (статья), question (вопрос), section (раздел статьи, ссылка с якорем).
//   В titleHtml разрешён только <mark> (совпадение) — остальное выводится как текст; title — текст.
// - ↑↓ — по подсказкам, Enter — открыть выбранную или отправить форму (все результаты), Esc —
//   закрыть окно. Без скрипта форма просто уходит на страницу результатов.
const MIN_CHARS = 2
const DELAY = 300
const LIMIT = 5
const PREVIEW = {
	article: ['document', ''],
	section: ['document', ''],
	question: ['help', 'help-search__preview--question'],
}

const escapeHtml = (value) =>
	String(value ?? '').replace(
		/[&<>"']/g,
		(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
	)
// Разрешён только <mark>: всё экранируем и возвращаем метки совпадений
const markOnly = (html) => escapeHtml(html).replace(/&lt;(\/?)mark&gt;/g, '<$1mark>')

export default function HelpSearch(root) {
	const input = root.querySelector('[data-help-search-input]')
	const clear = root.querySelector('[data-help-search-clear]')
	const panel = root.querySelector('[data-help-search-panel]')
	const list = root.querySelector('[data-help-search-list]')
	const empty = root.querySelector('[data-help-search-empty]')
	const all = root.querySelector('[data-help-search-all]')
	const url = root.dataset.suggestUrl
	if (!input || !panel || !list || !url) return undefined

	const allText = root.dataset.allText || 'Все результаты в Помощи'
	let timer = 0
	let controller = null
	let active = -1
	let disposed = false

	const options = () => [...list.querySelectorAll('[role="option"]')]

	const setActive = (index) => {
		const items = options()
		active = items.length ? (index + items.length) % items.length : -1
		items.forEach((item, i) => item.classList.toggle('is-active', i === active))
		if (active >= 0) {
			input.setAttribute('aria-activedescendant', items[active].id)
			items[active].scrollIntoView({ block: 'nearest' })
		} else input.removeAttribute('aria-activedescendant')
	}

	const open = () => {
		panel.hidden = false
		input.setAttribute('aria-expanded', 'true')
	}

	const close = () => {
		panel.hidden = true
		input.setAttribute('aria-expanded', 'false')
		setActive(-1)
	}

	const render = ({ count = 0, items = [] }) => {
		list.replaceChildren(
			...items.slice(0, LIMIT).map((item, i) => {
				const [iconName, previewClass] = PREVIEW[item.type] || PREVIEW.article
				const li = document.createElement('li')
				li.setAttribute('role', 'presentation')
				const link = document.createElement('a')
				link.className = 'help-search__item'
				link.id = `${input.id}-option-${i}`
				link.href = item.url || '#'
				link.setAttribute('role', 'option')
				link.tabIndex = -1
				const preview = document.createElement('span')
				preview.className = `help-search__preview${previewClass ? ` ${previewClass}` : ''}`
				preview.append(icon(iconName, 'help-search__preview-icon'))
				const text = document.createElement('span')
				text.className = 'help-search__text'
				const title = document.createElement('span')
				title.className = 'help-search__title'
				if (item.titleHtml) title.innerHTML = markOnly(item.titleHtml)
				else title.textContent = item.title ?? ''
				text.append(title)
				if (item.meta) {
					const meta = document.createElement('span')
					meta.className = 'help-search__meta'
					meta.textContent = item.meta
					text.append(meta)
				}
				link.append(preview, text)
				li.append(link)
				return li
			})
		)
		const found = items.length > 0
		empty.hidden = found
		if (!found) empty.textContent = root.dataset.emptyText || ''
		all.hidden = !found
		all.textContent = `${allText} · ${count}`
		setActive(-1)
		open()
		announce(found ? `Найдено: ${count}` : empty.textContent)
	}

	const load = async (query) => {
		controller?.abort()
		controller = new AbortController()
		const params = new URLSearchParams(new FormData(root))
		params.set(input.name, query)
		try {
			const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}${params}`, {
				signal: controller.signal,
				headers: { Accept: 'application/json' },
			})
			if (!response.ok) throw new Error(String(response.status))
			const data = await response.json()
			if (!disposed && input.value.trim() === query) render(data)
		} catch (error) {
			// Подсказки — подспорье: без них форма всё так же ведёт на страницу результатов
			if (error.name !== 'AbortError' && !disposed) close()
		}
	}

	const onInput = () => {
		const query = input.value.trim()
		if (clear) clear.hidden = !input.value
		clearTimeout(timer)
		if (query.length < MIN_CHARS) {
			controller?.abort()
			close()
			return
		}
		timer = window.setTimeout(() => load(query), DELAY)
	}

	const onKeydown = (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (panel.hidden || !options().length) return
			event.preventDefault()
			setActive(active + (event.key === 'ArrowDown' ? 1 : -1))
		} else if (event.key === 'Enter' && active >= 0) {
			event.preventDefault()
			options()[active].click()
		} else if (event.key === 'Escape' && !panel.hidden) {
			event.preventDefault()
			close()
		}
	}

	const onFocus = () => {
		if (input.value.trim().length >= MIN_CHARS && (list.children.length || !empty.hidden)) open()
	}

	const onDocumentPointer = (event) => {
		if (!root.contains(event.target)) close()
	}

	const onFocusOut = (event) => {
		if (!root.contains(event.relatedTarget)) close()
	}

	const onClear = () => {
		input.value = ''
		onInput()
		input.focus()
	}

	input.addEventListener('input', onInput)
	input.addEventListener('keydown', onKeydown)
	input.addEventListener('focus', onFocus)
	root.addEventListener('focusout', onFocusOut)
	clear?.addEventListener('click', onClear)
	document.addEventListener('pointerdown', onDocumentPointer)

	return () => {
		disposed = true
		clearTimeout(timer)
		controller?.abort()
		input.removeEventListener('input', onInput)
		input.removeEventListener('keydown', onKeydown)
		input.removeEventListener('focus', onFocus)
		root.removeEventListener('focusout', onFocusOut)
		clear?.removeEventListener('click', onClear)
		document.removeEventListener('pointerdown', onDocumentPointer)
	}
}

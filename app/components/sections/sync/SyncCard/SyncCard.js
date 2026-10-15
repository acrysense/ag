// Карточка обмена с 1С.
// «Запустить» — POST на data-run-href (sessid и период из поля), ответ JSON { status, message }.
// Пока обмен идёт (running, queue — и после запуска, и если он уже шёл при загрузке страницы),
// каждые POLL мс GET на data-status-href → { status }; время с начала (data-started) тикает раз в
// секунду. Обмен закончился — карточка заменяется свежей из этой же страницы (по id): данные
// выводит бэк, скрипт их не собирает. «?» открывает подсказку: нажатием, наведением мыши, с
// клавиатуры; закрывают Esc, нажатие мимо и уход фокуса.
import { announce } from '@/utils/announce'

const POLL = 5000
const HOVER_OPEN = 150
const HOVER_CLOSE = 250
const ACTIVE = ['running', 'queue']
const sessid = () => window.BX?.bitrix_sessid?.() || ''
const loadedAt = Date.now()

const pad = (n) => String(n).padStart(2, '0')
const elapsed = (from) => {
	const s = Math.max(0, Math.floor((Date.now() - from) / 1000))
	return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const runButton = root.querySelector('[data-sync-run]')
	const select = root.querySelector('[data-sync-select]')
	const message = root.querySelector('[data-sync-message]')
	const help = root.querySelector('[data-sync-help]')
	const tip = root.querySelector('[data-sync-tip]')
	const title = root.querySelector('.sync-card__title')?.textContent.trim() || ''
	let tick = 0
	let poll = 0
	let hoverTimer = 0

	// ---------- Таймер и опрос ----------

	const startTimer = () => {
		const timer = root.querySelector('[data-sync-timer]')
		if (!timer) return
		// Начало обмена от бэка; нет — с открытия страницы
		const started = Date.parse(root.dataset.started || '')
		const from = Number.isNaN(started) ? loadedAt : started
		const render = () => {
			timer.textContent = elapsed(from)
		}
		render()
		clearInterval(tick)
		tick = setInterval(render, 1000)
	}

	const setMessage = (text, type = '') => {
		if (!message) return
		message.className = `sync-card__message${type ? ` sync-card__message--${type}` : ''}`
		message.textContent = text
	}

	// Свежая карточка из этой же страницы; раскрыта/свёрнута — как была
	const refresh = async () => {
		try {
			const response = await fetch(window.location.href, {
				credentials: 'same-origin',
				signal,
			})
			if (!response.ok) throw new Error(String(response.status))
			const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
			const fresh = doc.getElementById(root.id)
			if (!fresh || !root.isConnected) throw new Error('no card')
			const open = root.querySelector('.sync-card__details')?.open
			const details = fresh.querySelector('.sync-card__details')
			if (details) details.open = Boolean(open)
			const state = fresh.dataset.state
			root.replaceWith(document.importNode(fresh, true))
			if (state === 'success') announce(`Обмен «${title}» завершён`)
			if (state === 'error') announce(`Обмен «${title}» завершён с ошибкой`)
		} catch (error) {
			if (signal.aborted) return
			setMessage('Не удалось обновить статус. Обновите страницу.', 'error')
		}
	}

	const check = async () => {
		const url = root.dataset.statusHref
		if (!url) return
		try {
			const response = await fetch(url, {
				credentials: 'same-origin',
				headers: { Accept: 'application/json' },
				signal,
			})
			if (!response.ok) throw new Error(String(response.status))
			const data = await response.json()
			if (ACTIVE.includes(data.status)) {
				poll = setTimeout(check, POLL)
				return
			}
			await refresh()
		} catch (error) {
			if (signal.aborted) return
			// Сеть моргнула — пробуем ещё раз позже
			poll = setTimeout(check, POLL * 2)
		}
	}

	const watch = () => {
		startTimer()
		clearTimeout(poll)
		poll = setTimeout(check, POLL)
	}

	// ---------- Ручной запуск ----------

	const setRunning = () => {
		root.dataset.state = 'running'
		root.className = root.className.replace(/sync-card--\S+/, 'sync-card--running')
		const status = root.querySelector('[data-sync-status]')
		if (status) {
			status.className = 'sync-status sync-status--running'
			status.textContent = 'Выполняется'
		}
		if (!root.dataset.started) root.dataset.started = new Date().toISOString()
		if (message) {
			message.className = 'sync-card__message'
			message.textContent = 'Идёт обмен с 1С, дождитесь окончания. Время: '
			const timer = document.createElement('b')
			timer.className = 'sync-card__timer'
			timer.dataset.syncTimer = ''
			message.append(timer)
		}
	}

	const run = async () => {
		const url = root.dataset.runHref
		if (!url || runButton.disabled) return
		runButton.disabled = true
		runButton.classList.add('is-loading')
		if (select) select.disabled = true
		root.setAttribute('aria-busy', 'true')

		const body = new FormData()
		body.set('sessid', sessid())
		if (select) body.set(select.name, select.value)
		// GET — только демо со статичным JSON (data-run-method="get")
		const post = root.dataset.runMethod?.toLowerCase() !== 'get'

		try {
			const response = await fetch(url, {
				method: post ? 'POST' : 'GET',
				body: post ? body : undefined,
				credentials: 'same-origin',
				headers: { Accept: 'application/json', 'X-Bitrix-Csrf-Token': sessid() },
				signal,
			})
			const data = await response.json().catch(() => ({}))
			if (!response.ok || !ACTIVE.includes(data.status)) {
				throw new Error(data.message || 'Не удалось запустить обмен. Попробуйте ещё раз.')
			}
			if (data.startedAt) root.dataset.started = data.startedAt
			else delete root.dataset.started
			setRunning()
			announce(`Обмен «${title}» запущен`)
			watch()
		} catch (error) {
			if (signal.aborted) return
			runButton.disabled = false
			runButton.classList.remove('is-loading')
			if (select) select.disabled = false
			setMessage(error.message || 'Не удалось запустить обмен. Попробуйте ещё раз.', 'error')
		} finally {
			root.removeAttribute('aria-busy')
		}
	}

	runButton?.addEventListener('click', run, { signal })
	if (ACTIVE.includes(root.dataset.state)) watch()

	// ---------- Подсказка «?» ----------

	const isOpen = () => help?.getAttribute('aria-expanded') === 'true'
	const open = () => {
		if (!help || !tip || isOpen()) return
		tip.hidden = false
		help.setAttribute('aria-expanded', 'true')
	}
	const close = () => {
		if (!help || !tip || !isOpen()) return
		tip.hidden = true
		help.setAttribute('aria-expanded', 'false')
	}
	const hover = (fn, delay) => {
		clearTimeout(hoverTimer)
		hoverTimer = setTimeout(fn, delay)
	}
	const mouse = (event) => event.pointerType === 'mouse'

	if (help && tip) {
		help.addEventListener('click', () => (isOpen() ? close() : open()), { signal })
		for (const el of [help, tip]) {
			el.addEventListener('pointerenter', (e) => mouse(e) && hover(open, HOVER_OPEN), { signal })
			el.addEventListener('pointerleave', (e) => mouse(e) && hover(close, HOVER_CLOSE), { signal })
		}
		root.addEventListener(
			'keydown',
			(event) => {
				if (event.key !== 'Escape' || !isOpen()) return
				close()
				help.focus()
			},
			{ signal }
		)
		root.addEventListener(
			'focusout',
			(event) => {
				if (!help.contains(event.relatedTarget) && !tip.contains(event.relatedTarget)) close()
			},
			{ signal }
		)
		document.addEventListener(
			'pointerdown',
			(event) => {
				if (!help.contains(event.target) && !tip.contains(event.target)) close()
			},
			{ signal }
		)
	}

	return () => {
		controller.abort()
		clearInterval(tick)
		clearTimeout(poll)
		clearTimeout(hoverTimer)
	}
}

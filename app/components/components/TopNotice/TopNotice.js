// Плашка-объявление над шапкой. Видна сразу (её высоту скрипт не задаёт — страница не съезжает).
// Крестик — плашка сворачивается и закрытие запоминается до конца дня в cookie ag_top_notice
// (значение — data-key): сервер закрытую плашку не выводит, как на сайте. Если страница пришла с
// закрытой плашкой (кеш или закрытие записано только в localStorage прежней версией) — скрипт
// прячет её сразу, без сворачивания.
const COOKIE = 'ag_top_notice'

const readCookie = (name) =>
	document.cookie
		.split('; ')
		.find((part) => part.startsWith(`${name}=`))
		?.slice(name.length + 1)

const today = () => {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function init(root) {
	if (!root) return
	const btn = root.querySelector('.top-notice__close, [data-top-notice-close]')
	const name = root.dataset.cookieName || COOKIE
	const key = encodeURIComponent(root.dataset.key || 'global')
	const storeKey = `topNotice:${root.dataset.key || 'global'}:date`

	const remember = () => {
		const end = new Date()
		end.setHours(23, 59, 59, 999)
		const secure = window.location.protocol === 'https:' ? '; Secure' : ''
		document.cookie = `${name}=${key}; Expires=${end.toUTCString()}; Path=/; SameSite=Lax${secure}`
		try {
			localStorage.setItem(storeKey, today())
		} catch {}
	}

	const hideNow = () => {
		root.classList.add('is-hidden')
		root.setAttribute('aria-hidden', 'true')
	}

	let stored = null
	try {
		stored = localStorage.getItem(storeKey)
	} catch {}
	if (readCookie(name) === key || stored === '1' || stored === today()) {
		root.style.transition = 'none'
		hideNow()
		if (readCookie(name) !== key) remember()
	}

	const onClose = (event) => {
		event.preventDefault()
		remember()
		const hadFocus = document.activeElement === btn
		// Сначала явная высота (пересчёт раскладки), потом 0 — иначе сворачивание из «без
		// ограничения» не анимируется
		root.style.setProperty('--h', `${root.scrollHeight}px`)
		root.classList.add('is-closing')
		void root.offsetHeight
		hideNow()
		if (hadFocus) root.nextElementSibling?.querySelector('a[href], button')?.focus()
	}
	btn?.addEventListener('click', onClose)

	return () => {
		btn?.removeEventListener('click', onClose)
	}
}

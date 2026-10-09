// «Вопросы по странице»: стрелка сворачивает блок до шапки и разворачивает обратно. Выбор
// запоминается в браузере для каждого блока (по id) — на следующих страницах он такой же.
const KEY = 'ag:help-inline:'

export default function HelpInline(root) {
	const toggle = root.querySelector('[data-help-inline-toggle]')
	const label = root.querySelector('[data-help-inline-label]')
	if (!toggle) return undefined
	const key = KEY + (root.id || 'default')

	const set = (minimized, persist) => {
		root.classList.toggle('is-minimized', minimized)
		toggle.setAttribute('aria-expanded', String(!minimized))
		if (label) label.textContent = minimized ? 'Развернуть вопросы' : 'Свернуть вопросы'
		if (!persist) return
		try {
			if (minimized) localStorage.setItem(key, '1')
			else localStorage.removeItem(key)
		} catch {}
	}

	let saved = false
	try {
		saved = localStorage.getItem(key) === '1'
	} catch {}
	set(saved, false)

	const onClick = () => set(!root.classList.contains('is-minimized'), true)
	toggle.addEventListener('click', onClick)
	return () => toggle.removeEventListener('click', onClick)
}

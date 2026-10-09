// Навигация по Помощи: с 1280 список всегда открыт (строка «Разделы помощи» скрыта), до 1280 —
// свёрнут и открывается по нажатию. Без скрипта details открыт на любой ширине.
const DESKTOP = '(min-width: 1280px)'

export default function HelpNav(root) {
	const query = window.matchMedia(DESKTOP)
	const sync = () => {
		root.open = query.matches
	}
	sync()
	query.addEventListener('change', sync)
	return () => query.removeEventListener('change', sync)
}

// Навигация по Помощи: с 1280 список всегда открыт (строка «Разделы помощи» скрыта), до 1280 —
// свёрнут и открывается по нажатию. Без скрипта details открыт на любой ширине. Анимация раскрытия —
// только после первой расстановки (is-ready), чтобы при загрузке список не сворачивался на глазах.
const DESKTOP = '(min-width: 1280px)'

export default function HelpNav(root) {
	const query = window.matchMedia(DESKTOP)
	const sync = () => {
		root.open = query.matches
	}
	sync()
	const frame = requestAnimationFrame(() => root.classList.add('is-ready'))
	query.addEventListener('change', sync)
	return () => {
		cancelAnimationFrame(frame)
		query.removeEventListener('change', sync)
	}
}

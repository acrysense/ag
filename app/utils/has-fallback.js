// Браузеры без :has() (Firefox до 121) — то же, что делают правила с :has(), классами; стили
// рядом с этими правилами. В браузерах с :has() ничего не делает. Бэку ничего не нужно: разметка
// та же, как на ag-site (utils/has-fallback.js).
// - .tasks-list.has-visible-rows — в списке есть видимая задача: «Нет задач» прячется;
// - .data-table.data-table--wide — 14+ колонок: таблица шире, колонки делят место поровну.
const supportsHas = () => {
	try {
		return CSS.supports('selector(:has(*))')
	} catch {
		return false
	}
}

export function watchHasFallbacks() {
	if (supportsHas()) return () => {}

	let frame = 0
	const sync = () => {
		frame = 0
		document.querySelectorAll('.tasks-list').forEach((list) => {
			const visible = [...list.children].some(
				(el) =>
					el.classList.contains('task-row') &&
					!el.classList.contains('is-filtered-out') &&
					!el.classList.contains('is-hidden')
			)
			list.classList.toggle('has-visible-rows', visible)
		})
		document.querySelectorAll('.data-table').forEach((table) => {
			table.classList.toggle(
				'data-table--wide',
				table.querySelectorAll('.data-table__th').length >= 14
			)
		})
	}
	// Пересчёт не чаще раза за кадр: задачи добавляют, фильтруют и прячут скриптом, таблицы строятся
	// после загрузки данных
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(sync)
	}
	const observer = new MutationObserver(schedule)
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'hidden'],
	})
	sync()

	return () => {
		observer.disconnect()
		cancelAnimationFrame(frame)
	}
}

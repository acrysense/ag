// Скелетон загрузки из JS — те же классы, что у components/Skeleton (вид — там же), как на
// ag-site. skeleton('text') — одна заготовка; skeletonLines(3) — абзац из строк;
// loadingLabel('Загрузка задач…') — текст для скринридера (сам скелетон от него скрыт).
export function skeleton(variant = 'text', className = '') {
	const el = document.createElement('span')
	el.className = `skeleton skeleton--${variant}${className ? ` ${className}` : ''}`
	el.setAttribute('aria-hidden', 'true')
	return el
}

export function skeletonLines(count = 3, className = '') {
	const el = document.createElement('span')
	el.className = `skeleton-lines${className ? ` ${className}` : ''}`
	el.setAttribute('aria-hidden', 'true')
	for (let i = 0; i < count; i++) el.append(skeleton('text'))
	return el
}

export function loadingLabel(text) {
	const el = document.createElement('span')
	el.className = 'visually-hidden'
	el.setAttribute('role', 'status')
	el.textContent = text
	return el
}

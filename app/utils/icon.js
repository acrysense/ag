// Перенесено с ag-site (utils/icon.js): иконки блоков сайта, которые создаёт JS.
// Иконка из SVG-спрайта для разметки, которую создаёт JS. Спрайт — отдельный файл
// (assets/icons/sprite.svg), путь к нему — в <html data-icons="…/sprite.svg">: его выводит шаблон
// сайта, как и <use href="…/sprite.svg#icon-…"> в разметке блоков.
const SVG = 'http://www.w3.org/2000/svg'

// Ссылка на иконку спрайта ЛК: файл из <html data-icons> (как на ag-site). Без data-icons (старая
// разметка бэка) — ссылка внутри страницы, на спрайт, встроенный скриптом
export const spriteHref = (id) => `${document.documentElement.dataset.icons || ''}#icon-${id}`

// Иконки блоков сайта в спрайте ЛК — icon-site-… (app/assets/icons/site)
export const iconHref = (name) => spriteHref(`site-${name}`)

export function createIcon(name, className = '') {
	const svg = document.createElementNS(SVG, 'svg')
	svg.setAttribute('class', `icon${className ? ` ${className}` : ''}`)
	svg.setAttribute('aria-hidden', 'true')
	svg.setAttribute('focusable', 'false')
	const use = document.createElementNS(SVG, 'use')
	use.setAttribute('href', iconHref(name))
	svg.append(use)
	return svg
}

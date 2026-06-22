// Lightweight, dependency-free date picker popover.
// Styled via .ui-datepicker* classes. Returns a disposer that removes every
// listener and the generated popover, so re-mounting never duplicates handlers.

const MONTHS = [
	'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`

function parse(value) {
	const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value || '').trim())
	if (!m) return null
	const day = +m[1], month = +m[2] - 1, year = +m[3]
	const d = new Date(year, month, day)
	return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year ? d : null
}

export function mountDatepicker(el) {
	if (!el || el.__datepickerBound) return null
	el.__datepickerBound = true

	const input = el.querySelector('[data-datepicker-input]')
	const toggle = el.querySelector('[data-datepicker-toggle]')
	if (!input) {
		delete el.__datepickerBound
		return null
	}

	const pop = document.createElement('div')
	pop.className = 'ui-datepicker__pop'
	pop.setAttribute('hidden', '')
	el.appendChild(pop)

	let open = false
	let view = parse(input.value) || new Date()

	function build() {
		const year = view.getFullYear()
		const month = view.getMonth()
		const selected = parse(input.value)
		const first = new Date(year, month, 1)
		const startOffset = (first.getDay() + 6) % 7 // Monday-first
		const daysInMonth = new Date(year, month + 1, 0).getDate()

		let cells = ''
		for (let i = 0; i < startOffset; i++) cells += '<span class="ui-datepicker__cell is-empty"></span>'
		for (let day = 1; day <= daysInMonth; day++) {
			const isSel =
				selected &&
				selected.getDate() === day &&
				selected.getMonth() === month &&
				selected.getFullYear() === year
			cells += `<button type="button" class="ui-datepicker__cell${isSel ? ' is-selected' : ''}" data-day="${day}">${day}</button>`
		}

		pop.innerHTML = `
			<div class="ui-datepicker__head">
				<button type="button" class="ui-datepicker__nav" data-nav="-1" aria-label="Предыдущий месяц">‹</button>
				<span class="ui-datepicker__caption">${MONTHS[month]} ${year}</span>
				<button type="button" class="ui-datepicker__nav" data-nav="1" aria-label="Следующий месяц">›</button>
			</div>
			<div class="ui-datepicker__weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
			<div class="ui-datepicker__grid">${cells}</div>`
	}

	function show() {
		if (open) return
		open = true
		view = parse(input.value) || new Date()
		build()
		pop.removeAttribute('hidden')
		el.classList.add('is-open')
		document.addEventListener('pointerdown', onDocDown, true)
		document.addEventListener('keydown', onKey, true)
	}
	function hide() {
		if (!open) return
		open = false
		pop.setAttribute('hidden', '')
		el.classList.remove('is-open')
		document.removeEventListener('pointerdown', onDocDown, true)
		document.removeEventListener('keydown', onKey, true)
	}

	const onDocDown = (e) => {
		if (!el.contains(e.target)) hide()
	}
	const onKey = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault()
			hide()
			input.focus({ preventScroll: true })
		}
	}
	const onPopClick = (e) => {
		const nav = e.target.closest('[data-nav]')
		if (nav) {
			view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1)
			build()
			return
		}
		const cell = e.target.closest('[data-day]')
		if (cell) {
			const picked = new Date(view.getFullYear(), view.getMonth(), Number(cell.dataset.day))
			input.value = fmt(picked)
			input.dispatchEvent(new Event('change', { bubbles: true }))
			hide()
		}
	}
	const onToggle = (e) => {
		e.preventDefault()
		open ? hide() : show()
	}
	const onInputFocus = () => show()
	// keep typed input formatted as dd.mm.yyyy
	const onInput = () => {
		const digits = input.value.replace(/\D/g, '').slice(0, 8)
		const parts = []
		if (digits.length > 0) parts.push(digits.slice(0, 2))
		if (digits.length > 2) parts.push(digits.slice(2, 4))
		if (digits.length > 4) parts.push(digits.slice(4, 8))
		input.value = parts.join('.')
	}

	pop.addEventListener('click', onPopClick)
	toggle?.addEventListener('click', onToggle)
	input.addEventListener('focus', onInputFocus)
	input.addEventListener('input', onInput)

	return () => {
		hide()
		pop.removeEventListener('click', onPopClick)
		toggle?.removeEventListener('click', onToggle)
		input.removeEventListener('focus', onInputFocus)
		input.removeEventListener('input', onInput)
		pop.remove()
		delete el.__datepickerBound
	}
}

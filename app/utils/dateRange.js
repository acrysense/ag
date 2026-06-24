// Range date-picker for a .filter-field[data-daterange]. Renders a calendar
// (reuses .ui-datepicker* classes) inside the field's panel and lets the user
// pick a from–to range; clicking the same day twice yields a single day.
// Exposes field.__dateRange = { getRange(), clear() } and calls onChange.

const MONTHS = [
	'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
const ymd = (y, m, day) => new Date(y, m, day).setHours(0, 0, 0, 0)

export function mountDateRange(field, onChange, { single = false } = {}) {
	if (!field || field.__dateRangeBound) return () => {}
	field.__dateRangeBound = true

	const valueEl = field.querySelector('.filter-field__value')
	const panel = field.querySelector('.filter-field__panel')
	if (!panel) {
		delete field.__dateRangeBound
		return () => {}
	}

	let start = null // timestamp (midnight)
	let end = null
	let view = new Date(2026, 4, 1) // demo data lives in May 2026

	const setLabel = () => {
		if (!valueEl) return
		const ph = valueEl.dataset.placeholder || 'Дата'
		if (start && end) {
			valueEl.textContent = start === end ? fmt(new Date(start)) : `${fmt(new Date(start))} – ${fmt(new Date(end))}`
		} else if (start) {
			valueEl.textContent = fmt(new Date(start))
		} else {
			valueEl.textContent = ph
		}
	}

	const build = () => {
		const year = view.getFullYear()
		const month = view.getMonth()
		const first = new Date(year, month, 1)
		const startOffset = (first.getDay() + 6) % 7 // Monday-first
		const daysInMonth = new Date(year, month + 1, 0).getDate()
		const lo = start && end ? Math.min(start, end) : start
		const hi = start && end ? Math.max(start, end) : start

		let cells = ''
		for (let i = 0; i < startOffset; i++) cells += '<span class="ui-datepicker__cell is-empty"></span>'
		for (let day = 1; day <= daysInMonth; day++) {
			const t = ymd(year, month, day)
			let cls = 'ui-datepicker__cell'
			if (lo != null && hi != null) {
				if (t === lo || t === hi) cls += ' is-selected'
				else if (t > lo && t < hi) cls += ' is-range'
			} else if (lo != null && t === lo) {
				cls += ' is-selected'
			}
			cells += `<button type="button" class="${cls}" data-day="${day}">${day}</button>`
		}

		panel.innerHTML = `
			<div class="ui-datepicker__head">
				<button type="button" class="ui-datepicker__nav" data-nav="-1" aria-label="Предыдущий месяц">‹</button>
				<span class="ui-datepicker__caption">${MONTHS[month]} ${year}</span>
				<button type="button" class="ui-datepicker__nav" data-nav="1" aria-label="Следующий месяц">›</button>
			</div>
			<div class="ui-datepicker__weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
			<div class="ui-datepicker__grid">${cells}</div>`
	}

	const pickDay = (day) => {
		const t = ymd(view.getFullYear(), view.getMonth(), day)
		if (single) {
			// single-date mode: one click selects the day and completes
			start = t
			end = t
		} else if (start == null || (start != null && end != null)) {
			start = t
			end = null
		} else if (t >= start) {
			end = t
		} else {
			start = t
			end = null
		}
		build()
		setLabel()
		onChange?.()
		// range complete (two dates, or the same day twice) → close the calendar
		if (start != null && end != null) field.classList.remove('is-open')
	}

	const onClick = (e) => {
		const nav = e.target.closest('[data-nav]')
		if (nav) {
			view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1)
			build()
			return
		}
		const cell = e.target.closest('[data-day]')
		if (cell) pickDay(Number(cell.dataset.day))
	}

	field.__dateRange = {
		// from/to as dd.mm.yyyy (single day → from === to)
		getRange() {
			if (!start) return null
			const lo = end ? Math.min(start, end) : start
			const hi = end ? Math.max(start, end) : start
			return { from: fmt(new Date(lo)), to: fmt(new Date(hi)) }
		},
		clear() {
			start = null
			end = null
			view = new Date(2026, 4, 1)
			build()
			setLabel()
		},
	}

	panel.addEventListener('click', onClick)
	build()
	setLabel()

	return () => {
		panel.removeEventListener('click', onClick)
		delete field.__dateRange
		delete field.__dateRangeBound
	}
}

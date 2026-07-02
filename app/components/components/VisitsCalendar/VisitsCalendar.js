// Visits planning calendar: month / week / day views, prev–next navigation and
// a per-event popup. Page-agnostic — demo data is generated deterministically
// from the anchor month so it renders without a backend. Replace `eventsForDay`
// (or feed real data via a [data-calendar-data] JSON blob) for live data.

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']
const WEEKDAYS_SHORT = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const EMPLOYEES = [
	{ name: 'Медицинская Т.В.', cat: 'b' },
	{ name: 'Сорокина Д.А.', cat: 'b' },
	{ name: 'Березова С.Н.', cat: 'c' },
	{ name: 'Рябова А.А.', cat: 'b' },
	{ name: 'Браун К.К.', cat: 'b' },
	{ name: 'Иванова О.А.', cat: 'd' },
	{ name: 'Петров С.В.', cat: 'a' },
]

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

// deterministic demo events for a given date (weekdays only)
function eventsForDay(date) {
	if (isWeekend(date)) return []
	const day = date.getDate()
	const dateStr = dmy(date)
	const out = []
	EMPLOYEES.forEach((e, i) => {
		if ((day + i) % 3 === 0) return // skip ~1/3 → vary day to day
		out.push({
			name: e.name,
			cat: e.cat,
			time: `${String(8 + (i % 9)).padStart(2, '0')}:00`,
			date: dateStr,
			phone: '+375 29 890-23-23',
			pharmacy: 'Могилев, ADEL, Аптека №12',
			manager: 'Петров А.И.',
			managerPhone: '+375 29 123-10-10',
			managerEmail: 'petrov_manager@phg.by',
			type: 'Коучинг',
			comment: 'Улучшить мотивацию сотрудника. Обсудить недостаточно высокие показатели продаж СТМ. Средний чек.',
			status: (day + i) % 2 === 0 ? 'confirmed' : 'planned',
			confirmedDate: '09.03.2026, 12:24',
			coords: '5534444.442442 , 455543.222345',
			checklist: '78 / 100',
			cancelled: day % 9 === 0 && i % 4 === 1,
		})
	})
	return out.sort((a, b) => a.time.localeCompare(b.time))
}

// Monday of the week that contains `date`
function mondayOf(date) {
	const d = new Date(date)
	const dow = (d.getDay() + 6) % 7 // 0 = Monday
	d.setDate(d.getDate() - dow)
	d.setHours(0, 0, 0, 0)
	return d
}

export default async function VisitsCalendar(root) {
	if (root.__visitsCalBound) return
	root.__visitsCalBound = true

	// registry so a clicked event button can recover its full data by id
	const eventStore = new Map()
	let eventSeq = 0
	const reg = (ev) => {
		const id = String(++eventSeq)
		eventStore.set(id, ev)
		return id
	}
	// month-view event (thin coloured bar + name)
	const eventHTML = (ev) =>
		`<button type="button" class="vcal__event vcal__event--${esc(ev.cat)}${ev.cancelled ? ' is-cancelled' : ''}" data-event-id="${reg(ev)}"><span class="vcal__dot"></span><span class="vcal__event-name">${esc(ev.name)}</span></button>`

	// anchor: data-anchor="YYYY-MM-DD" or May 2026 (matches the design)
	const anchorAttr = root.dataset.anchor
	const start = anchorAttr ? new Date(anchorAttr) : new Date(2026, 4, 1)
	// On mobile the single-column Day view is the usable default; desktop keeps Month.
	const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 743px)').matches
	let view = isMobile ? 'day' : 'month'
	let cursor = new Date(start.getFullYear(), start.getMonth(), isWeekend(start) ? start.getDate() + 1 : start.getDate())
	cursor.setHours(0, 0, 0, 0)

	const disposers = []

	// JSON-driven events (data-visits-src / inline data-visits-data). Falls back to
	// the built-in demo generator when neither is set, so the static page still works.
	let eventIndex = null // Map<'dd.mm.yyyy', event[]>
	const dayEvents = (date) => {
		if (!eventIndex) return eventsForDay(date) // demo fallback
		return (eventIndex.get(dmy(date)) || []).slice().sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
	}

	// ---- view bodies ------------------------------------------------------
	function monthGrid() {
		const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
		const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
		let d = mondayOf(first)
		const weeks = []
		while (d <= last || d.getDay() !== 1) {
			const row = []
			for (let i = 0; i < 5; i++) {
				// Mon..Fri
				const cell = new Date(d)
				row.push(cell)
				d.setDate(d.getDate() + 1)
			}
			d.setDate(d.getDate() + 2) // skip Sat+Sun
			weeks.push(row)
			if (weeks.length > 6) break
		}
		const cells = weeks
			.map(
				(week) =>
					`<div class="vcal__row">` +
					week
						.map((cell) => {
							const out = cell.getMonth() !== cursor.getMonth()
							const evs = dayEvents(cell)
							return `<div class="vcal__cell${out ? ' is-out' : ''}">
								<span class="vcal__daynum">${cell.getDate()}</span>
								<div class="vcal__events">${evs.map(eventHTML).join('')}${out ? '' : '<button type="button" class="vcal__add" data-visit-create>+ Создать визит</button>'}</div>
							</div>`
						})
						.join('') +
					`</div>`
			)
			.join('')
		return `<div class="vcal__weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div><div class="vcal__grid">${cells}</div>`
	}

	function weekDays() {
		const mon = mondayOf(cursor)
		return Array.from({ length: 5 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i))
	}

	// shared time grid (hours × day columns) — 1 column for "day", 5 for "week"
	function timeGrid(days) {
		const head =
			`<span class="vcal__tcorner"></span>` +
			days
				.map(
					(d) =>
						`<div class="vcal__tcol-head"><span>${WEEKDAYS[(d.getDay() + 6) % 7]}</span><b>${String(d.getDate()).padStart(2, '0')}</b></div>`
				)
				.join('')
		let rows = ''
		for (let h = 8; h <= 18; h++) {
			const hh = `${String(h).padStart(2, '0')}:00`
			rows += `<span class="vcal__hour">${hh}</span>`
			rows += days
				.map((date) => {
					const evs = dayEvents(date).filter((e) => e.time === hh)
					const inner = evs
						.map(
							(ev) =>
								`<button type="button" class="vcal__tevent vcal__event--${esc(ev.cat)}${ev.cancelled ? ' is-cancelled' : ''}" data-event-id="${reg(ev)}">
								<span class="data-table__cat data-table__cat--${esc(ev.cat)}">${esc(ev.cat)}</span>
								<span class="vcal__tevent-body"><span class="vcal__tevent-name">${esc(ev.name)}</span><span class="vcal__tevent-sub">${esc(ev.pharmacy.split(',').pop().trim())}</span></span>
							</button>`
						)
						.join('')
					return `<div class="vcal__tcell">${inner || '<button type="button" class="vcal__add" data-visit-create>+ Создать визит</button>'}</div>`
				})
				.join('')
		}
		return `<div class="vcal__tgrid"><div class="vcal__tgrid-inner" style="--days:${days.length}">${head}${rows}</div></div>`
	}

	// ---- shell ------------------------------------------------------------
	function titleText() {
		if (view === 'day') return `<span>${String(cursor.getDate()).padStart(2, '0')} ${WEEKDAYS_SHORT[(cursor.getDay() + 6) % 7]}</span>`
		if (view === 'week') {
			const mon = mondayOf(cursor)
			const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4)
			const pad = (d) => String(d.getDate()).padStart(2, '0')
			// same month → "05 – 09 май"; spans two months → "30 апр – 04 май"
			if (mon.getMonth() === fri.getMonth()) return `<span>${pad(mon)} – ${pad(fri)} ${MONTHS[fri.getMonth()]}</span>`
			return `<span>${pad(mon)} ${MONTHS_SHORT[mon.getMonth()]} – ${pad(fri)} ${MONTHS_SHORT[fri.getMonth()]}</span>`
		}
		return `<span>${MONTHS[cursor.getMonth()]}</span>`
	}

	function render() {
		eventStore.clear()
		eventSeq = 0
		const body = view === 'day' ? timeGrid([cursor]) : view === 'week' ? timeGrid(weekDays()) : monthGrid()
		root.innerHTML = `
			<div class="vcal__head">
				<h2 class="vcal__title">План визитов, ${titleText()}</h2>
				<div class="vcal__nav">
					<button type="button" class="vcal__navbtn" data-prev aria-label="Назад"><svg aria-hidden="true" focusable="false" width="12" height="12"><use href="#icon-arrow-left"></use></svg></button>
					<button type="button" class="vcal__navbtn" data-next aria-label="Вперёд"><svg aria-hidden="true" focusable="false" width="12" height="12"><use href="#icon-arrow-right"></use></svg></button>
				</div>
			</div>
			<div class="vcal__controls">
				<button type="button" class="vcal__create" data-visit-create><svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-plus"></use></svg>Создать визит</button>
				<div class="vcal__views">
					<button type="button" class="vcal__view${view === 'day' ? ' is-active' : ''}" data-view="day">День</button>
					<button type="button" class="vcal__view${view === 'week' ? ' is-active' : ''}" data-view="week">Неделя</button>
					<button type="button" class="vcal__view${view === 'month' ? ' is-active' : ''}" data-view="month">Месяц</button>
				</div>
			</div>
			<div class="vcal__body vcal__body--${view}">${body}</div>`
	}

	// ---- event popup ------------------------------------------------------
	let popup = null
	const closePopup = () => {
		popup?.remove()
		popup = null
	}
	const ICON_MGR = '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 16c0-3 2.4-4.8 5.5-4.8S15.5 13 15.5 16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
	const ICON_TYPE = '<svg viewBox="0 0 20 20" fill="none"><rect x="4.5" y="3.5" width="11" height="13" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 3.5h4M7 10l1.8 1.8L12.5 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
	const ICON_CHECK = '<svg viewBox="0 0 16 16" fill="none"><path d="M4.5 8.5l2.3 2.3L11.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

	function openPopup(trigger, ev) {
		closePopup()
		if (!ev) return
		const planned = ev.status !== 'confirmed'
		popup = document.createElement('div')
		popup.className = 'vcal-pop'

		const head = `<div class="vcal-pop__card">
			<div class="vcal-pop__who"><span class="data-table__cat data-table__cat--${esc(ev.cat)}">${esc(ev.cat)}</span><b>${esc(ev.name)}</b></div>
			<div class="vcal-pop__when">${esc(ev.date)} в ${esc(ev.time)}</div>
			<div class="vcal-pop__muted">${esc(ev.phone)}</div>
			<div class="vcal-pop__muted">${esc(ev.pharmacy)}</div>
			${planned ? `<button type="button" class="vcal-pop__edit" data-visit-create data-visit-prefill="${esc(JSON.stringify({ employee: ev.name, date: ev.date, time: ev.time, manager: ev.manager, type: ev.type, comment: ev.comment }))}">Изменить</button>` : ''}
		</div>`

		const mgr = `<div class="vcal-pop__card">
			<div class="vcal-pop__row">${ICON_MGR}<b>${esc(ev.manager)}</b></div>
			<div class="vcal-pop__muted">${esc(ev.managerPhone)}</div>
			<div class="vcal-pop__muted">${esc(ev.managerEmail)}</div>
		</div>`

		const body = planned
			? `<div class="vcal-pop__card">
				<div class="vcal-pop__row">${ICON_TYPE}<span>${esc(ev.type)}</span></div>
				<div class="vcal-pop__comment vcal-pop__comment--muted">${esc(ev.comment)}</div>
			</div>`
			: `<div class="vcal-pop__card">
				<div class="vcal-pop__row vcal-pop__row--ok"><span class="vcal-pop__check">${ICON_CHECK}</span><b>Визит подтвержден</b></div>
				<div class="vcal-pop__muted">${esc(ev.confirmedDate)}</div>
				<div class="vcal-pop__coords">${esc(ev.coords)}</div>
				<div class="vcal-pop__field"><span class="vcal-pop__label">Тип визита</span><div>${esc(ev.type)}</div></div>
				<div class="vcal-pop__field"><span class="vcal-pop__label">Чек-лист</span><a href="/visit" class="vcal-pop__link">${esc(ev.checklist)}</a></div>
				<div class="vcal-pop__field"><span class="vcal-pop__label">Комментарии</span><div class="vcal-pop__comment">${esc(ev.comment)}</div></div>
			</div>`

		const footer = planned
			? '<div class="vcal-pop__footer"><button type="button" class="btn">Начать визит</button><button type="button" class="vcal-pop__del">Удалить визит</button></div>'
			: '<div class="vcal-pop__footer"><a href="/visit" class="btn">Подробнее</a></div>'

		popup.innerHTML = head + mgr + body + footer
		document.body.appendChild(popup)
		const r = trigger.getBoundingClientRect()
		const top = Math.min(window.scrollY + r.bottom + 6, window.scrollY + window.innerHeight - popup.offsetHeight - 12)
		popup.style.top = `${Math.max(window.scrollY + 12, top)}px`
		popup.style.left = `${Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - popup.offsetWidth - 12)}px`
	}

	// ---- one delegated handler --------------------------------------------
	const onRootClick = (e) => {
		const vbtn = e.target.closest('[data-view]')
		if (vbtn) {
			view = vbtn.dataset.view
			render()
			return
		}
		if (e.target.closest('[data-prev]')) {
			step(-1)
			return
		}
		if (e.target.closest('[data-next]')) {
			step(1)
			return
		}
		const evbtn = e.target.closest('[data-event-id]')
		if (evbtn) {
			openPopup(evbtn, eventStore.get(evbtn.dataset.eventId))
			return
		}
		// [data-create] is a no-op stub for now
	}
	function step(dir) {
		if (view === 'day') {
			do {
				cursor.setDate(cursor.getDate() + dir)
			} while (isWeekend(cursor))
		} else if (view === 'week') {
			cursor.setDate(cursor.getDate() + dir * 7)
		} else {
			cursor.setMonth(cursor.getMonth() + dir, 1)
			if (isWeekend(cursor)) cursor.setDate(cursor.getDate() + (cursor.getDay() === 6 ? 2 : 1))
		}
		render()
	}

	const onDocClick = (e) => {
		if (!popup) return
		// a create/edit trigger opens the visit modal → close the floating popup first
		if (e.target.closest('[data-visit-create]')) return closePopup()
		// close when clicking outside the popup (and not on another event)
		if (!popup.contains(e.target) && !e.target.closest('[data-event-id]')) closePopup()
	}

	root.addEventListener('click', onRootClick)
	document.addEventListener('click', onDocClick)
	disposers.push(() => root.removeEventListener('click', onRootClick))
	disposers.push(() => document.removeEventListener('click', onDocClick))
	disposers.push(closePopup)

	// JSON mode: fetch the visits before the first render (loader meanwhile)
	const src = root.dataset.visitsSrc
	const inlineEl = root.querySelector('[data-visits-data]')
	if (src || inlineEl) {
		root.innerHTML = '<div class="vcal__loader"><span class="vcal__spinner" aria-hidden="true"></span><span>Загрузка визитов…</span></div>'
		let data = null
		try {
			data = src ? await (await fetch(src, { headers: { Accept: 'application/json' } })).json() : JSON.parse(inlineEl.textContent)
		} catch (err) {
			console.warn('[VisitsCalendar] failed to load visits', err)
		}
		const list = Array.isArray(data) ? data : data && Array.isArray(data.visits) ? data.visits : []
		eventIndex = new Map()
		list.forEach((ev) => {
			if (!ev || !ev.date) return
			if (!eventIndex.has(ev.date)) eventIndex.set(ev.date, [])
			eventIndex.get(ev.date).push(ev)
		})
	}

	render()

	return () => {
		disposers.forEach((d) => d())
		delete root.__visitsCalBound
	}
}

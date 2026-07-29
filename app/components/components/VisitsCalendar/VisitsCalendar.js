// Visits planning calendar: month / week / day views, prev–next navigation and
// a per-event popup. Page-agnostic — demo data is generated deterministically
// from the anchor month so it renders without a backend. Replace `eventsForDay`
// (or feed real data via a [data-calendar-data] JSON blob) for live data.

// base-aware link to the visit page (Vite sets BASE_URL per build:
// "/" locally, "/ag/" on GitHub Pages, "/bitrix/templates/auth/" for cms)
const VISIT_HREF = import.meta.env.BASE_URL + 'visit'

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
// no visits in the past: a cell whose day is before today shouldn't pre-fill its date
// into the create form (the datepicker blocks past dates, so a prefilled past date is
// inconsistent). Returns the dd.mm.yyyy string only for today-or-future days.
const dmyIfFuture = (d) => {
	const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
	const today = new Date()
	return day < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? '' : dmy(d)
}

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

	// Link to the visit detail / checklist page. In production the backend points us
	// at the real page via data-visit-detail-url (e.g. "/erp/visits/detail.php") or the
	// AG_VISIT_DETAIL_URL global, and we append ?id=<visit id>. Without a configured URL
	// (or a visit id) we fall back to the base-relative demo page so the calendar still
	// works standalone.
	const detailBase =
		root.dataset.visitDetailUrl || (typeof window !== 'undefined' && window.AG_VISIT_DETAIL_URL) || ''
	const visitDetailHref = (ev) => {
		if (!detailBase) return VISIT_HREF
		const id = ev && ev.id != null ? ev.id : null
		if (id == null) return detailBase
		return `${detailBase}${detailBase.includes('?') ? '&' : '?'}id=${encodeURIComponent(id)}`
	}

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

	// One authoritative, MUTABLE store keyed by 'dd.mm.yyyy'. JSON mode fills it from
	// the backend; demo mode materialises each visible day from the generator once and
	// caches it. Drag-and-drop mutates this store in place, so a moved visit survives
	// re-renders and navigation in both modes.
	const store = new Map() // Map<'dd.mm.yyyy', event[]>
	let jsonMode = false
	const bucket = (date) => {
		const key = dmy(date)
		if (!store.has(key)) store.set(key, jsonMode || isWeekend(date) ? [] : eventsForDay(date).map((e) => ({ ...e })))
		return store.get(key)
	}
	const dayEvents = (date) => bucket(date).slice().sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))

	// move a visit to another day (and hour, in the time grid). Returns true if something
	// actually changed. Both source and target days are on screen during a drop, so their
	// buckets already exist in the store.
	function moveEvent(ev, toDate, toHour) {
		if (!ev || !toDate) return false
		const fromKey = ev.date
		if (fromKey === toDate && (!toHour || ev.time === toHour)) return false // dropped on itself
		const fromArr = store.get(fromKey)
		if (fromArr) {
			const i = fromArr.indexOf(ev)
			if (i >= 0) fromArr.splice(i, 1)
		}
		ev.date = toDate
		if (toHour) ev.time = toHour
		if (!store.has(toDate)) store.set(toDate, [])
		store.get(toDate).push(ev)
		return true
	}

	// persist a move: always emit a DOM event (so integrators can react without an
	// endpoint), and POST to data-visits-action-url / window.AG_VISITS_ACTION_URL if set.
	function saveMove(ev, prev) {
		// keep the DOM event for integrators (unchanged shape)
		const detail = { action: 'move', id: ev.id ?? null, employee: ev.name, date: ev.date, time: ev.time, from: prev }
		root.dispatchEvent(new CustomEvent('visit:move', { detail, bubbles: true }))
		// backend contract: a drag-move is an `update` with id + new date/time (omitted
		// fields are left untouched). Fire-and-forget — the tile has already moved.
		postVisit('update', { id: ev.id ?? null, date: ev.date, time: ev.time })
			.then(() => refreshVisitTables())
			.catch((err) => {
				console.warn('[VisitsCalendar] move save failed', err)
				// revert the optimistic move so the grid doesn't silently diverge from the
				// server, and tell the user (matches the delete path's feedback)
				moveEvent(ev, prev.date, prev.time)
				render()
				window.toast?.error('Не удалось перенести визит. Попробуйте ещё раз.')
			})
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
							return `<div class="vcal__cell${out ? ' is-out' : ''}"${out ? '' : ` data-date="${dmy(cell)}"`}>
								<span class="vcal__daynum">${cell.getDate()}</span>
								<div class="vcal__events">${evs.map(eventHTML).join('')}${out ? '' : `<button type="button" class="vcal__add" data-visit-create data-visit-prefill="${esc(JSON.stringify({ date: dmyIfFuture(cell) }))}">+ Создать визит</button>`}</div>
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
					return `<div class="vcal__tcell" data-date="${dmy(date)}" data-hour="${hh}">${inner || `<button type="button" class="vcal__add" data-visit-create data-visit-prefill="${esc(JSON.stringify({ date: dmyIfFuture(date), time: hh }))}"><svg aria-hidden="true" focusable="false" width="12" height="12"><use href="#icon-plus"></use></svg>Создать визит</button>`}</div>`
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
	let backdrop = null
	let popupEv = null // the event the open popup belongs to (for delete)
	const closePopup = () => {
		popup?.remove()
		backdrop?.remove()
		popup = null
		backdrop = null
		popupEv = null
	}

	// POST a visit mutation to the backend (same endpoint/convention as the modal).
	// No endpoint → demo mode: resolve success so the calendar works standalone.
	async function postVisit(action, payload) {
		const url = root.dataset.visitsActionUrl || (typeof window !== 'undefined' && window.AG_VISITS_ACTION_URL)
		if (!url) return { ok: true }
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ action, ...payload }),
		})
		const data = await res.json().catch(() => null)
		if (!res.ok || (data && data.ok === false)) throw new Error((data && data.error) || `HTTP ${res.status}`)
		return data || { ok: true }
	}

	// Remove an event from the store (in place, so no reload after a delete).
	const removeFromStore = (ev) => {
		const bucket = store.get(ev.date)
		if (!bucket) return
		const i = bucket.indexOf(ev)
		if (i > -1) bucket.splice(i, 1)
	}
	const ICON_MGR = '<svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-manager"></use></svg>'
	const ICON_TYPE = '<svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-visit-type"></use></svg>'

	function openPopup(trigger, ev) {
		closePopup()
		if (!ev) return
		popupEv = ev
		const planned = ev.status !== 'confirmed'
		popup = document.createElement('div')
		popup.className = 'vcal-pop'

		const head = `<div class="vcal-pop__card">
			<div class="vcal-pop__who"><span class="data-table__cat data-table__cat--${esc(ev.cat)}">${esc(ev.cat)}</span><b>${esc(ev.name)}</b></div>
			<div class="vcal-pop__when">${esc(ev.date)} в ${esc(ev.time)}</div>
			<div class="vcal-pop__muted-group">
				<div class="vcal-pop__muted">${esc(ev.phone)}</div>
				<div class="vcal-pop__muted">${esc(ev.pharmacy)}</div>
			</div>
			${planned ? `<button type="button" class="vcal-pop__edit" data-visit-create data-visit-prefill="${esc(JSON.stringify({ edit: true, id: ev.id ?? null, employee: ev.employee ?? '', manager: ev.managerCode ?? '', type: ev.type, date: ev.date, time: ev.time, comment: ev.comment, status: ev.status ?? null }))}">Изменить</button>` : ''}
		</div>`

		const mgr = `<div class="vcal-pop__card">
			<div class="vcal-pop__row">${ICON_MGR}<span>${esc(ev.manager)}</span></div>
			<div class="vcal-pop__muted-group">
				<div class="vcal-pop__muted vcal-pop__muted--lg">${esc(ev.managerPhone)}</div>
				<div class="vcal-pop__muted vcal-pop__muted--lg">${esc(ev.managerEmail)}</div>
			</div>
		</div>`

		const body = planned
			? `<div class="vcal-pop__card">
				<div class="vcal-pop__row">${ICON_TYPE}<span>${esc(ev.type)}</span></div>
				<div class="vcal-pop__comment vcal-pop__comment--muted">${esc(ev.comment)}</div>
			</div>`
			: `<div class="vcal-pop__card">
				<div class="vcal-pop__row vcal-pop__row--ok"><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-check-circle"></use></svg><b>Визит подтвержден</b></div>
				<div class="vcal-pop__muted">${esc(ev.confirmedDate)}</div>
				<div class="vcal-pop__coords">${esc(ev.coords)}</div>
				<div class="vcal-pop__field-group">
					<div class="vcal-pop__field"><span class="vcal-pop__label">Тип визита</span><div>${esc(ev.type)}</div></div>
					<div class="vcal-pop__field"><span class="vcal-pop__label">Чек-лист</span><a href="${esc(visitDetailHref(ev))}" class="vcal-pop__link">${esc(ev.checklist)}</a></div>
					<div class="vcal-pop__field"><span class="vcal-pop__label">Комментарии</span><div class="vcal-pop__comment">${esc(ev.comment)}</div></div>
				</div>
			</div>`

		const footer = planned
			? `<div class="vcal-pop__footer"><a href="${esc(visitDetailHref(ev))}" class="btn">Начать визит</a><button type="button" class="vcal-pop__del">Удалить визит</button></div>`
			: `<div class="vcal-pop__footer"><a href="${esc(visitDetailHref(ev))}" class="btn">Подробнее</a></div>`

		const closeBtn =
			'<button type="button" class="vcal-pop__close" aria-label="Закрыть"><svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-close"></use></svg></button>'
		popup.innerHTML = closeBtn + head + mgr + body + footer
		// mobile: a blurred backdrop turns the popup into a tap-to-dismiss modal
		// (a plain positioned card is fiddly to close on touch); desktop keeps the
		// small card anchored next to the trigger. The backdrop click closes via
		// the existing outside-click handler.
		backdrop = document.createElement('div')
		backdrop.className = 'vcal-pop-backdrop'
		document.body.appendChild(backdrop)
		document.body.appendChild(popup)
		if (!window.matchMedia('(max-width: 743px)').matches) {
			const r = trigger.getBoundingClientRect()
			const top = Math.min(window.scrollY + r.bottom + 6, window.scrollY + window.innerHeight - popup.offsetHeight - 12)
			popup.style.top = `${Math.max(window.scrollY + 12, top)}px`
			popup.style.left = `${Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - popup.offsetWidth - 12)}px`
		}
	}

	// ---- drag & drop (mouse + touch + pen via Pointer Events) -------------
	// A visit tile is both clickable (opens the popup) and draggable. We tell them
	// apart with a small movement threshold: below it → a tap/click; above it → a
	// drag. On touch, the tiles carry `touch-action:none` (see SCSS) so dragging one
	// never fights the calendar's own scroll.
	const DRAG_THRESHOLD = 6
	let drag = null
	let suppressClick = false

	const positionGhost = (d, x, y) => {
		d.ghost.style.left = `${x - d.offX}px`
		d.ghost.style.top = `${y - d.offY}px`
	}
	const dropCellAt = (x, y) => {
		const el = document.elementFromPoint(x, y) // ghost is pointer-events:none → sees the cell beneath
		return el ? el.closest('.vcal__tcell[data-date], .vcal__cell[data-date]') : null
	}
	const beginDrag = (d) => {
		d.armed = true
		try {
			root.setPointerCapture(d.pointerId)
		} catch {}
		const r = d.el.getBoundingClientRect()
		const ghost = d.el.cloneNode(true)
		ghost.classList.add('vcal__drag-ghost')
		ghost.style.width = `${r.width}px`
		ghost.removeAttribute('data-event-id')
		document.body.appendChild(ghost)
		d.ghost = ghost
		d.offX = d.startX - r.left
		d.offY = d.startY - r.top
		d.el.classList.add('is-dragging')
		root.classList.add('is-dragging-active')
		document.body.classList.add('vcal-dragging')
		positionGhost(d, d.startX, d.startY)
	}
	const endDrag = () => {
		if (!drag) return
		const d = drag
		drag = null
		d.ghost?.remove()
		d.el?.classList.remove('is-dragging')
		d.dropCell?.classList.remove('is-drop-target')
		root.classList.remove('is-dragging-active')
		document.body.classList.remove('vcal-dragging')
		try {
			root.releasePointerCapture(d.pointerId)
		} catch {}
	}

	const onPointerDown = (e) => {
		if (drag) return
		if (e.pointerType === 'mouse' && e.button !== 0) return
		const el = e.target.closest('[data-event-id]')
		if (!el || !root.contains(el)) return
		drag = { id: el.dataset.eventId, el, pointerId: e.pointerId, type: e.pointerType, startX: e.clientX, startY: e.clientY, armed: false }
	}
	const onPointerMove = (e) => {
		if (!drag || drag.pointerId !== e.pointerId) return
		if (!drag.armed) {
			if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
			beginDrag(drag)
		}
		e.preventDefault()
		positionGhost(drag, e.clientX, e.clientY)
		const cell = dropCellAt(e.clientX, e.clientY)
		if (cell !== drag.dropCell) {
			drag.dropCell?.classList.remove('is-drop-target')
			drag.dropCell = cell
			cell?.classList.add('is-drop-target')
		}
	}
	const onPointerUp = (e) => {
		if (!drag || drag.pointerId !== e.pointerId) return
		if (!drag.armed) return endDrag() // never moved → let the click open the popup
		const cell = drag.dropCell
		const ev = eventStore.get(drag.id) // resolve BEFORE render() clears the registry
		endDrag()
		// swallow the click that fires right after a drag so it doesn't open the popup
		suppressClick = true
		setTimeout(() => (suppressClick = false), 400)
		if (!cell || !ev) return
		const prev = { date: ev.date, time: ev.time }
		if (moveEvent(ev, cell.dataset.date, cell.dataset.hour)) {
			render()
			saveMove(ev, prev)
		}
	}
	const onPointerCancel = () => endDrag()
	const onKeydown = (e) => {
		if (e.key === 'Escape' && drag) endDrag() // abort: no data mutated until drop
	}

	// ---- one delegated handler --------------------------------------------
	const onRootClick = (e) => {
		if (suppressClick) {
			suppressClick = false
			return
		}
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

	let deleting = false
	const onDocClick = (e) => {
		if (!popup) return
		// explicit close button (mobile modal)
		if (e.target.closest('.vcal-pop__close')) return closePopup()
		// delete the visit: POST delete, then drop the tile in place (no reload)
		if (e.target.closest('.vcal-pop__del')) {
			e.preventDefault()
			const ev = popupEv
			if (!ev || deleting) return
			deleting = true
			const delBtn = e.target.closest('.vcal-pop__del')
			delBtn.setAttribute('disabled', '')
			postVisit('delete', { id: ev.id ?? null })
				.then(() => {
					removeFromStore(ev)
					closePopup()
					render()
					refreshVisitTables()
				})
				.catch((err) => {
					console.warn('[VisitsCalendar] delete failed', err)
					window.toast?.error('Не удалось удалить визит. Попробуйте ещё раз.')
					delBtn.removeAttribute('disabled')
				})
				.finally(() => {
					deleting = false
				})
			return
		}
		// a create/edit trigger opens the visit modal → close the floating popup first
		if (e.target.closest('[data-visit-create]')) return closePopup()
		// close when clicking outside the popup (and not on another event)
		if (!popup.contains(e.target) && !e.target.closest('[data-event-id]')) closePopup()
	}

	root.addEventListener('click', onRootClick)
	document.addEventListener('click', onDocClick)
	// pointer listeners drive drag-and-drop; move needs {passive:false} to preventDefault
	root.addEventListener('pointerdown', onPointerDown)
	root.addEventListener('pointermove', onPointerMove, { passive: false })
	root.addEventListener('pointerup', onPointerUp)
	root.addEventListener('pointercancel', onPointerCancel)
	document.addEventListener('keydown', onKeydown)
	disposers.push(() => root.removeEventListener('click', onRootClick))
	disposers.push(() => document.removeEventListener('click', onDocClick))
	disposers.push(() => root.removeEventListener('pointerdown', onPointerDown))
	disposers.push(() => root.removeEventListener('pointermove', onPointerMove))
	disposers.push(() => root.removeEventListener('pointerup', onPointerUp))
	disposers.push(() => root.removeEventListener('pointercancel', onPointerCancel))
	disposers.push(() => document.removeEventListener('keydown', onKeydown))
	disposers.push(endDrag)
	disposers.push(closePopup)

	// The create/edit modal dispatches `visit:saved`; update our store in place and
	// cancel the modal's fallback page-reload. If we can't apply the change (missing
	// data / unknown id), we leave the event alone so the modal still reloads — a save
	// is never silently dropped.
	const findEvent = (id) => {
		if (id == null) return null
		for (const [key, arr] of store) {
			const i = arr.findIndex((e) => String(e.id) === String(id))
			if (i > -1) return { arr, i, ev: arr[i], key }
		}
		return null
	}
	// After any visit change, re-pull the visit tables on the page (e.g. «История
	// визитов») so they stay in sync without a full reload. No-op for tables without
	// a data-table-src (nothing to re-fetch). Debounced so a burst of edits (adding a
	// row of visits back-to-back) collapses into one refetch instead of one per action.
	let refreshTimer = null
	const refreshVisitTables = () => {
		clearTimeout(refreshTimer)
		refreshTimer = setTimeout(() => {
			document.querySelectorAll('[data-data-table]').forEach((t) => t.__dataTable?.refresh?.())
		}, 250)
	}
	disposers.push(() => clearTimeout(refreshTimer))
	const onVisitSaved = (e) => {
		const d = e.detail || {}
		if (d.action === 'create') {
			const f = d.fields || {}
			const l = d.labels || {}
			// Prefer the full visit from the response; otherwise build a tile straight
			// from the submitted form values + select labels, so we insert in place even
			// when the backend returns just {ok:true, id} — no page reload either way.
			const v =
				d.visit && d.visit.date
					? { ...d.visit, id: d.visit.id ?? d.id }
					: f.date
					? {
							id: d.id,
							date: f.date,
							time: f.time,
							name: l.employee || f.employee || '',
							employee: f.employee,
							managerCode: f.manager,
							manager: l.manager || '',
							type: f.type,
							comment: f.comment,
							status: 'planned',
							cat: '',
					  }
					: null
			if (!v || !v.date) return // nothing usable → let the modal reload
			// de-dup: if this id is already on the board (double-dispatch), update in
			// place instead of adding a second tile
			const existing = v.id != null ? findEvent(v.id) : null
			if (existing) {
				existing.arr.splice(existing.i, 1)
			}
			if (!store.has(v.date)) store.set(v.date, [])
			store.get(v.date).push(v)
			e.preventDefault()
			render()
			refreshVisitTables()
		} else if (d.action === 'update') {
			const found = findEvent(d.id)
			if (!found) return // unknown visit → reload so the server view stays correct
			const { arr, i, ev } = found
			const f = d.fields || {}
			const l = d.labels || {}
			const next = d.visit
				? { ...ev, ...d.visit }
				: {
						...ev,
						date: f.date || ev.date,
						time: f.time || ev.time,
						type: f.type || ev.type,
						comment: f.comment ?? ev.comment,
						employee: f.employee || ev.employee,
						managerCode: f.manager || ev.managerCode,
						name: l.employee || ev.name,
						manager: l.manager || ev.manager,
				  }
			arr.splice(i, 1) // drop from the old day bucket…
			if (!store.has(next.date)) store.set(next.date, [])
			store.get(next.date).push(next) // …and add to the (possibly new) one
			e.preventDefault()
			render()
			refreshVisitTables()
		}
	}
	document.addEventListener('visit:saved', onVisitSaved)
	disposers.push(() => document.removeEventListener('visit:saved', onVisitSaved))

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
		jsonMode = true
		list.forEach((ev) => {
			if (!ev || !ev.date) return
			if (!store.has(ev.date)) store.set(ev.date, [])
			store.get(ev.date).push(ev)
		})
	}

	render()

	return () => {
		disposers.forEach((d) => d())
		delete root.__visitsCalBound
	}
}

// Master → detail on /manager: picking a pharmacy in «Аптеки в курации» reloads
// the staff table below (its title and its rows). Every pharmacy's staff list
// lives in one [data-staff-source] JSON blob, so the backend only has to render
// that blob — no extra request per pharmacy.
//
// Which pharmacy is shown first: optional `default` (a key of `pharmacies`) wins;
// otherwise the first entry. Keep `pharmacies` in the same order as the table's
// rows so that fallback is the table's first row.
//   {"default": "p2", "pharmacies": {"p1": {...}, "p2": {...}}}
//
// Mounted on .manager__staff-head because the panel itself already carries
// data-module="DataTable" (one module per element).
export default (head) => {
	const panel = head.closest('.manager__staff')
	const master = document.querySelector('.manager__pharmacies')
	if (!panel || !master) return
	// mount guard, same as DataTable/VisitsCalendar: this module injects the sheet
	// chrome, so a second run would stack another grabber and Закрыть into the panel
	if (head.__staffSwitcherBound) return
	head.__staffSwitcherBound = true

	const srcEl = panel.querySelector('[data-staff-source]')
	let source = {}
	try {
		source = JSON.parse(srcEl?.textContent || '{}')
	} catch (err) {
		console.warn('[StaffSwitcher] invalid data-staff-source JSON', err)
		return
	}
	const byKey = source.pharmacies || {}
	const order = Object.keys(byKey)
	if (!order.length) return

	const titleEl = panel.querySelector('[data-staff-title]')
	let current = byKey[source.default] ? source.default : order[0]

	// the master table re-creates its rows on every sort/filter/page change, so the
	// highlight is re-applied from the key rather than held on element references
	const markSelected = () => {
		master.querySelectorAll('[data-row-key]').forEach((row) => {
			row.classList.toggle('is-selected', row.dataset.rowKey === current)
		})
	}

	const render = () => {
		const item = byKey[current]
		if (!item) return
		if (titleEl) titleEl.textContent = item.name
		markSelected()
		// filters and sort survive the swap — a search/category stays applied
		panel.__dataTable?.setRows(item.rows || [])
	}

	const select = (key) => {
		if (!byKey[key] || key === current) return
		current = key
		render()
	}
	const step = (delta) => {
		const i = order.indexOf(current)
		select(order[(i + delta + order.length) % order.length])
	}

	const disposers = []
	const on = (el, ev, fn) => {
		el.addEventListener(ev, fn)
		disposers.push(() => el.removeEventListener(ev, fn))
	}

	// --- Mobile: the panel is a bottom sheet, not an inline card -------------
	// The backdrop is the dimmer AND the scroller; the panel moves inside it while open,
	// so scrolling lifts the whole sheet up over the dimmer and off the top — instead of
	// a pinned sheet scrolling its own guts. Moving the panel is safe: app.js's observer
	// skips relocations (a still-connected node isn't unmounted), so DataTable and this
	// module aren't re-initialised. Closing returns the panel to its page slot (marked
	// by panelHome). A body-level backdrop is also required to cover the viewport — the
	// panel's own ancestors would clip it otherwise.
	const isMobile = () => window.matchMedia('(max-width: 743.98px)').matches
	const grabber = document.createElement('div')
	grabber.className = 'manager__staff-grabber'
	panel.insertBefore(grabber, panel.firstChild)
	const acts = document.createElement('div')
	acts.className = 'manager__staff-sheet-actions'
	acts.innerHTML = '<button type="button" class="btn" data-staff-close>Закрыть</button>'
	panel.appendChild(acts)
	const panelHome = document.createComment('staff-panel-home')
	panel.before(panelHome)

	let backdrop = null
	const closeSheet = () => {
		if (!backdrop) return
		panel.classList.remove('is-open')
		panelHome.after(panel)
		backdrop.remove()
		backdrop = null
	}
	const openSheet = () => {
		if (!isMobile() || panel.classList.contains('is-open')) return
		backdrop = document.createElement('div')
		backdrop.className = 'manager__staff-backdrop'
		backdrop.addEventListener('click', (e) => {
			if (e.target === backdrop) closeSheet() // only the exposed dimmer strip
		})
		document.body.appendChild(backdrop)
		backdrop.appendChild(panel)
		panel.classList.add('is-open')
		backdrop.scrollTop = 0
	}
	on(panel, 'click', (e) => {
		if (e.target.closest('[data-staff-close]')) closeSheet()
	})
	const onKeydown = (e) => {
		if (e.key === 'Escape') closeSheet()
	}
	document.addEventListener('keydown', onKeydown)
	disposers.push(() => document.removeEventListener('keydown', onKeydown))
	disposers.push(closeSheet)

	// The grabber closes the sheet: a tap, or a downward pull past a threshold. Between
	// those (a small deliberate drag that's then released) the sheet snaps back. During
	// the pull the sheet follows the finger for feedback. One pointerup handles tap and
	// drag alike, so there's no click/drag race. touch-action:none (CSS) keeps the pull
	// from scrolling the backdrop.
	const CLOSE_PULL = 60 // drag past this → close
	const TAP_SLOP = 6 // moved less than this → it was a tap → close
	let drag = null
	const onGrabDown = (e) => {
		if (!panel.classList.contains('is-open')) return
		drag = { startY: e.clientY, dy: 0, id: e.pointerId }
		grabber.setPointerCapture?.(e.pointerId)
		panel.style.transition = 'none'
	}
	const onGrabMove = (e) => {
		if (!drag || drag.id !== e.pointerId) return
		drag.dy = Math.max(0, e.clientY - drag.startY) // down only
		panel.style.transform = `translateY(${drag.dy}px)`
	}
	const endGrab = (e) => {
		if (!drag || drag.id !== e.pointerId) return
		const pulled = drag.dy
		drag = null
		panel.style.transition = ''
		panel.style.transform = ''
		grabber.releasePointerCapture?.(e.pointerId)
		if (pulled > CLOSE_PULL || pulled < TAP_SLOP) closeSheet()
	}
	grabber.addEventListener('pointerdown', onGrabDown)
	grabber.addEventListener('pointermove', onGrabMove)
	grabber.addEventListener('pointerup', endGrab)
	grabber.addEventListener('pointercancel', endGrab)

	// delegated: the clicked button may not have existed when this module mounted
	on(master, 'click', (e) => {
		const btn = e.target.closest('[data-dt-select]')
		const row = btn?.closest('[data-row-key]')
		// open even when the pharmacy is already the current one — select() no-ops
		// on an unchanged key, but the tap still means "show me this staff list"
		if (row) {
			select(row.dataset.rowKey)
			openSheet()
		}
	})
	on(master, 'datatable:render', markSelected)

	// queried from the panel, not the head: placeNav() below moves the nav out of the
	// head on mobile. Listeners ride along with the element, so they bind once here.
	const prev = panel.querySelector('[data-staff-prev]')
	const next = panel.querySelector('[data-staff-next]')
	if (prev) on(prev, 'click', () => step(-1))
	if (next) on(next, 'click', () => step(1))

	// The arrows sit next to the title on desktop, but in the mobile sheet they belong
	// on the category row, pinned right (CSS handles the alignment). The two rows are
	// separate flex containers, so `order` can't do this — the node has to move.
	const nav = panel.querySelector('.manager__staff-nav')
	const controls = panel.querySelector('.manager__staff-controls')
	const mq = window.matchMedia('(max-width: 743.98px)')
	const placeNav = () => {
		if (!nav || !controls) return
		const host = mq.matches ? controls : head
		if (nav.parentElement !== host) host.appendChild(nav)
	}
	placeNav()
	mq.addEventListener('change', placeNav)
	disposers.push(() => mq.removeEventListener('change', placeNav))

	// DataTable builds asynchronously; if it hasn't finished yet, wait for its ready event
	if (panel.__dataTable) render()
	else {
		const onReady = (e) => {
			if (e.detail?.root !== panel) return
			document.removeEventListener('datatable:ready', onReady)
			render()
		}
		document.addEventListener('datatable:ready', onReady)
		disposers.push(() => document.removeEventListener('datatable:ready', onReady))
	}

	return () => {
		disposers.forEach((d) => d())
		delete head.__staffSwitcherBound
	}
}

// Master → detail on /manager: picking a pharmacy in «Аптеки в курации» reloads
// the staff table below (its title and its rows). Every pharmacy's staff list
// lives in one [data-staff-source] JSON blob, so the backend only has to render
// that blob — no extra request per pharmacy.
//
// Mounted on .manager__staff-head because the panel itself already carries
// data-module="DataTable" (one module per element).
export default (head) => {
	const panel = head.closest('.manager__staff')
	const master = document.querySelector('.manager__pharmacies')
	if (!panel || !master) return

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
	const rows = [...master.querySelectorAll('[data-pharmacy]')]
	let current = byKey[source.default] ? source.default : order[0]

	const render = () => {
		const item = byKey[current]
		if (!item) return
		if (titleEl) titleEl.textContent = item.name
		rows.forEach((row) => row.classList.toggle('is-selected', row.dataset.pharmacy === current))
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

	rows.forEach((row) => {
		const btn = row.querySelector('[data-pharmacy-select]')
		if (btn) on(btn, 'click', () => select(row.dataset.pharmacy))
	})
	const prev = head.querySelector('[data-staff-prev]')
	const next = head.querySelector('[data-staff-next]')
	if (prev) on(prev, 'click', () => step(-1))
	if (next) on(next, 'click', () => step(1))

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

	return () => disposers.forEach((d) => d())
}

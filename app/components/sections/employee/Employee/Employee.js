// Employee section behaviour. Currently: the custom "Сортировать по" dropdown
// in the mobile KPI block, which actually reorders the KPI items.
export default (root) => {
	if (!root || root.__employeeBound) return
	root.__employeeBound = true

	const disposers = []
	root.querySelectorAll('[data-kpi-sort]').forEach((el) => {
		const dispose = initSort(el, root)
		if (dispose) disposers.push(dispose)
	})

	const disposeView = initViewToggle(root)
	if (disposeView) disposers.push(disposeView)

	const disposeKpiSort = initKpiSort(root)
	if (disposeKpiSort) disposers.push(disposeKpiSort)

	const disposeRowWrap = initRowWrap(root)
	if (disposeRowWrap) disposers.push(disposeRowWrap)

	return () => {
		disposers.forEach((d) => d())
		delete root.__employeeBound
	}
}

// On mobile, stack a profile row (label over value) when its label wraps to 2+
// lines. Measured in the un-stacked state to avoid a layout feedback loop.
function initRowWrap(root) {
	const rows = [...root.querySelectorAll('.employee__row')]
	if (!rows.length) return null
	const mql = window.matchMedia('(max-width: 743.98px)')
	const STACKED = 'employee__row--stacked'

	const isWrapped = (el) => {
		const cs = getComputedStyle(el)
		let lh = parseFloat(cs.lineHeight)
		if (Number.isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.4
		return el.offsetHeight > lh * 1.5
	}

	const update = () => {
		const mobile = mql.matches
		rows.forEach((r) => r.classList.remove(STACKED)) // measure rows un-stacked
		if (!mobile) return
		const wraps = rows.map((r) => {
			const label = r.querySelector('.employee__label')
			return label ? isWrapped(label) : false
		})
		rows.forEach((r, i) => r.classList.toggle(STACKED, wraps[i]))
	}

	let frame = null
	const onResize = () => {
		cancelAnimationFrame(frame)
		frame = requestAnimationFrame(update)
	}

	update()
	window.addEventListener('resize', onResize)

	return () => {
		cancelAnimationFrame(frame)
		window.removeEventListener('resize', onResize)
		rows.forEach((r) => r.classList.remove(STACKED))
	}
}

// Column sorting for the desktop KPI grid. ИТОГ row stays pinned at the bottom.
// Click cycles asc → desc → original order.
function initKpiSort(root) {
	const grid = root.querySelector('.employee-kpi__grid')
	if (!grid) return null
	const cols = [...grid.querySelectorAll('.employee-kpi__col[data-kpi-col]')]
	const rows = [...grid.querySelectorAll('.employee-kpi__row:not(.employee-kpi__row--total)')]
	const total = grid.querySelector('.employee-kpi__row--total')
	if (!cols.length || !rows.length) return null

	const original = rows.slice()
	const disposers = []
	let active = null
	let dir = 0 // 1 asc, -1 desc, 0 none

	const num = (t) => {
		const n = parseFloat(String(t).replace(',', '.').replace(/[^\d.-]/g, ''))
		return Number.isNaN(n) ? 0 : n
	}
	const cellText = (row, i) => (row.children[i]?.textContent || '').trim()

	const reorder = (list) => list.forEach((r) => (total ? grid.insertBefore(r, total) : grid.appendChild(r)))

	const apply = (col) => {
		const i = cols.indexOf(col)
		const type = col.dataset.sortType || 'text'
		if (dir === 0) {
			reorder(original)
		} else {
			const sorted = rows.slice().sort((a, b) => {
				const av = cellText(a, i)
				const bv = cellText(b, i)
				const cmp = type === 'number' ? num(av) - num(bv) : av.localeCompare(bv, 'ru')
				return cmp * dir
			})
			reorder(sorted)
		}
		cols.forEach((c) => c.classList.remove('is-asc', 'is-desc'))
		if (dir === 1) col.classList.add('is-asc')
		else if (dir === -1) col.classList.add('is-desc')
	}

	cols.forEach((col) => {
		const onClick = () => {
			if (active !== col) {
				active = col
				dir = 1
			} else {
				dir = dir === 1 ? -1 : dir === -1 ? 0 : 1
			}
			if (dir === 0) active = null
			apply(col)
		}
		col.addEventListener('click', onClick)
		disposers.push(() => col.removeEventListener('click', onClick))
	})

	return () => {
		disposers.forEach((d) => d())
		reorder(original)
		cols.forEach((c) => c.classList.remove('is-asc', 'is-desc'))
	}
}

function initSort(sort, root) {
	const trigger = sort.querySelector('[data-kpi-sort-trigger]')
	const panel = sort.querySelector('[data-kpi-sort-panel]')
	const valueEl = sort.querySelector('[data-kpi-sort-value]')
	const options = [...sort.querySelectorAll('.employee-kpi__sort-option')]
	const list = root.querySelector('.employee-kpi__mlist')
	if (!trigger || !panel || !list) return null

	const items = [...list.querySelectorAll('.employee-kpi__mitem')]
	const original = items.slice()
	const total = list.querySelector('.employee-kpi__mtotal') // stays last
	const nameOf = (item) => (item.querySelector('.employee-kpi__mname')?.textContent || '').trim()

	function applySort(key, dir) {
		let ordered
		if (key === 'name') {
			ordered = items
				.slice()
				.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru') * (dir === 'desc' ? -1 : 1))
		} else {
			ordered = original.slice()
		}
		ordered.forEach((item) => {
			if (total) list.insertBefore(item, total)
			else list.appendChild(item)
		})
	}

	let open = false
	const setOpen = (state) => {
		open = state
		sort.classList.toggle('is-open', state)
		trigger.setAttribute('aria-expanded', state ? 'true' : 'false')
		if (state) {
			panel.removeAttribute('inert')
			panel.setAttribute('aria-hidden', 'false')
		} else {
			// Move focus out before hiding from a11y tree (avoids aria-hidden-on-focus warning).
			if (panel.contains(document.activeElement)) trigger.focus({ preventScroll: true })
			panel.setAttribute('aria-hidden', 'true')
			panel.setAttribute('inert', '')
		}
	}

	const onTrigger = (e) => {
		e.preventDefault()
		e.stopPropagation()
		setOpen(!open)
	}
	const onOption = (e) => {
		const option = e.target.closest('.employee-kpi__sort-option')
		if (!option) return
		options.forEach((o) => o.classList.toggle('is-active', o === option))
		if (valueEl) valueEl.textContent = option.textContent.trim()
		applySort(option.dataset.sort, option.dataset.dir)
		setOpen(false)
	}
	const onDocDown = (e) => {
		if (open && !sort.contains(e.target)) setOpen(false)
	}
	const onKey = (e) => {
		if (open && e.key === 'Escape') {
			e.preventDefault()
			setOpen(false)
			trigger.focus({ preventScroll: true })
		}
	}

	setOpen(false)
	trigger.addEventListener('click', onTrigger)
	panel.addEventListener('click', onOption)
	document.addEventListener('pointerdown', onDocDown, true)
	document.addEventListener('keydown', onKey, true)

	return () => {
		trigger.removeEventListener('click', onTrigger)
		panel.removeEventListener('click', onOption)
		document.removeEventListener('pointerdown', onDocDown, true)
		document.removeEventListener('keydown', onKey, true)
		sort.classList.remove('is-open')
		// restore the original DOM order
		original.forEach((item) => {
			if (total) list.insertBefore(item, total)
			else list.appendChild(item)
		})
	}
}

// Mobile view switch: column/list view vs. table-with-scroll view.
function initViewToggle(root) {
	const kpi = root.querySelector('.employee-kpi')
	const buttons = [...root.querySelectorAll('[data-kpi-view]')]
	if (!kpi || !buttons.length) return null

	const disposers = []
	buttons.forEach((btn) => {
		const onClick = () => {
			const isTable = btn.dataset.kpiView === 'table'
			kpi.classList.toggle('is-table-view', isTable)
			buttons.forEach((b) => {
				const on = b === btn
				b.classList.toggle('is-active', on)
				b.setAttribute('aria-pressed', on ? 'true' : 'false')
			})
		}
		btn.addEventListener('click', onClick)
		disposers.push(() => btn.removeEventListener('click', onClick))
	})

	return () => {
		disposers.forEach((d) => d())
		kpi.classList.remove('is-table-view')
	}
}

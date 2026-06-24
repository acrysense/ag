import { mountStaticPagination } from '@/utils/pagination'

// Reusable data-table behaviour: column sorting, row filtering, empty state and
// a simple page-size limiter. Page-agnostic — driven entirely by data-attrs:
//   [data-data-table]        host element (usually the card)
//   th[data-sort-key]        sortable header (+ data-sort-type="text|number|date")
//   td[data-filter-key]      cell that a named filter matches against
//   [data-table-empty]       element shown when nothing matches
//   [data-page-size]         optional page-size select (see below)
//
// Exposes root.__dataTable = { applyFilters({ query, filters }), reset() } so a
// filter UI (e.g. HeaderSearch) can drive it without tight coupling.

const norm = (s) => (s || '').toString().trim().toLowerCase()

function parseNumber(text) {
	const n = parseFloat(String(text).replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
	return Number.isNaN(n) ? 0 : n
}
function parseDate(text) {
	const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(text))
	return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0
}

export default (root) => {
	if (!root || root.__dataTableBound) return
	root.__dataTableBound = true

	const table = root.querySelector('table')
	const tbody = table?.querySelector('tbody')
	if (!table || !tbody) {
		delete root.__dataTableBound
		return
	}

	const emptyEl = root.querySelector('[data-table-empty]')
	const headers = [...table.querySelectorAll('th[data-sort-key]')]
	const allRows = [...tbody.querySelectorAll('tr')]
	const baseOrder = allRows.slice()
	const disposers = []

	// windowed pagination widget (visual; compacts on mobile so it never overflows)
	const pagNav = root.querySelector('.ui-pagination')
	if (pagNav) {
		const disposePag = mountStaticPagination(pagNav)
		if (disposePag) disposers.push(disposePag)
	}

	let state = { query: '', filters: [] }
	let sort = { key: null, dir: 0, type: 'text', th: null } // dir: 1 asc, -1 desc, 0 none
	let pageSize = Infinity

	const cellText = (row, key) => {
		const cell = row.querySelector(`[data-filter-key="${key}"]`)
		return cell ? norm(cell.textContent) : norm(row.textContent)
	}

	const matches = (row) => {
		if (state.query && !norm(row.textContent).includes(state.query)) return false
		// group active filter values by key → OR within a key, AND across keys
		const byKey = new Map()
		for (const f of state.filters) {
			if (!byKey.has(f.key)) byKey.set(f.key, [])
			byKey.get(f.key).push(norm(f.value))
		}
		for (const [key, values] of byKey) {
			const text = cellText(row, key)
			if (!values.some((v) => text.includes(v))) return false
		}
		return true
	}

	function recompute() {
		let matched = baseOrder.filter(matches)

		if (sort.key && sort.dir !== 0) {
			const idx = baseOrder.indexOf.bind(baseOrder)
			matched = matched.slice().sort((a, b) => {
				const av = a.querySelector(`[data-sort-key="${sort.key}"]`) || a.children[colIndex]
				const bv = b.querySelector(`[data-sort-key="${sort.key}"]`) || b.children[colIndex]
				const at = av ? av.textContent : ''
				const bt = bv ? bv.textContent : ''
				let cmp
				if (sort.type === 'number') cmp = parseNumber(at) - parseNumber(bt)
				else if (sort.type === 'date') cmp = parseDate(at) - parseDate(bt)
				else cmp = norm(at).localeCompare(norm(bt), 'ru')
				if (cmp === 0) cmp = idx(a) - idx(b) // stable
				return cmp * sort.dir
			})
		}

		// reflect order in the DOM and toggle visibility + page-size limit
		const matchedSet = new Set(matched)
		baseOrder.forEach((row) => {
			if (!matchedSet.has(row)) row.classList.add('is-hidden')
		})
		let shown = 0
		matched.forEach((row) => {
			tbody.appendChild(row)
			const visible = shown < pageSize
			row.classList.toggle('is-hidden', !visible)
			if (visible) shown++
		})

		if (emptyEl) emptyEl.hidden = matched.length > 0
	}

	// colIndex is resolved per sortable header when clicked
	let colIndex = 0

	// --- Sorting ---
	headers.forEach((th) => {
		const key = th.dataset.sortKey
		const type = th.dataset.sortType || 'text'
		th.classList.add('data-table__sort')
		const index = [...th.parentElement.children].indexOf(th)

		const onClick = () => {
			colIndex = index
			if (sort.key !== key) {
				sort = { key, dir: 1, type, th }
			} else {
				sort.dir = sort.dir === 1 ? -1 : sort.dir === -1 ? 0 : 1
				if (sort.dir === 0) sort.key = null
			}
			headers.forEach((h) => h.classList.remove('is-asc', 'is-desc'))
			if (sort.dir === 1) th.classList.add('is-asc')
			else if (sort.dir === -1) th.classList.add('is-desc')
			recompute()
		}
		th.addEventListener('click', onClick)
		disposers.push(() => th.removeEventListener('click', onClick))
	})

	// --- Page-size select (reuses the .page-size markup) ---
	root.querySelectorAll('[data-page-size]').forEach((select) => {
		const trigger = select.querySelector('[data-page-size-trigger]')
		const panel = select.querySelector('[data-page-size-panel]')
		const valueEl = select.querySelector('[data-page-size-value]')
		const options = [...select.querySelectorAll('.page-size__option')]
		if (!trigger || !panel) return

		const initial = valueEl ? parseInt(valueEl.textContent, 10) : NaN
		pageSize = Number.isNaN(initial) ? Infinity : initial

		let open = false
		const setOpen = (s) => {
			open = s
			select.classList.toggle('is-open', s)
			trigger.setAttribute('aria-expanded', s ? 'true' : 'false')
			panel.setAttribute('aria-hidden', s ? 'false' : 'true')
		}
		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			setOpen(!open)
		}
		const onOption = (e) => {
			const option = e.target.closest('.page-size__option')
			if (!option) return
			options.forEach((o) => o.classList.toggle('is-active', o === option))
			if (valueEl) valueEl.textContent = option.dataset.value
			pageSize = parseInt(option.dataset.value, 10) || Infinity
			setOpen(false)
			recompute()
		}
		const onDocDown = (e) => {
			if (open && !select.contains(e.target)) setOpen(false)
		}
		const onKey = (e) => {
			if (open && e.key === 'Escape') {
				e.preventDefault()
				setOpen(false)
			}
		}
		setOpen(false)
		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onOption)
		document.addEventListener('pointerdown', onDocDown, true)
		document.addEventListener('keydown', onKey, true)
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onOption)
			document.removeEventListener('pointerdown', onDocDown, true)
			document.removeEventListener('keydown', onKey, true)
		})
	})

	// --- Mobile card view: label each cell with its column header ---
	const headerLabels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
	allRows.forEach((row) => {
		;[...row.children].forEach((td, i) => {
			if (headerLabels[i]) td.setAttribute('data-label', headerLabels[i])
		})
	})

	// programmatic sort used by the mobile "Сортировать по" dropdown
	const sortByKey = (key, dir) => {
		if (!key || !dir) {
			sort = { key: null, dir: 0, type: 'text', th: null }
		} else {
			const th = headers.find((h) => h.dataset.sortKey === key)
			colIndex = th ? [...th.parentElement.children].indexOf(th) : 0
			sort = { key, dir: dir === 'desc' ? -1 : 1, type: th?.dataset.sortType || 'text', th }
		}
		headers.forEach((h) => h.classList.remove('is-asc', 'is-desc'))
		if (sort.th && sort.dir === 1) sort.th.classList.add('is-asc')
		else if (sort.th && sort.dir === -1) sort.th.classList.add('is-desc')
		recompute()
	}

	// --- "Сортировать по" dropdown (mobile) ---
	root.querySelectorAll('[data-dt-sort]').forEach((el) => {
		const trigger = el.querySelector('[data-dt-sort-trigger]')
		const panel = el.querySelector('[data-dt-sort-panel]')
		const valueEl = el.querySelector('[data-dt-sort-value]')
		const options = [...el.querySelectorAll('.data-table__sort-option')]
		if (!trigger || !panel) return

		let open = false
		const setOpen = (s) => {
			open = s
			el.classList.toggle('is-open', s)
			trigger.setAttribute('aria-expanded', s ? 'true' : 'false')
			panel.setAttribute('aria-hidden', s ? 'false' : 'true')
		}
		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			setOpen(!open)
		}
		const onOption = (e) => {
			const opt = e.target.closest('.data-table__sort-option')
			if (!opt) return
			options.forEach((o) => o.classList.toggle('is-active', o === opt))
			if (valueEl) valueEl.textContent = opt.textContent.trim()
			sortByKey(opt.dataset.sort === 'default' ? null : opt.dataset.sort, opt.dataset.dir)
			setOpen(false)
		}
		const onDocDown = (e) => {
			if (open && !el.contains(e.target)) setOpen(false)
		}
		setOpen(false)
		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onOption)
		document.addEventListener('pointerdown', onDocDown, true)
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onOption)
			document.removeEventListener('pointerdown', onDocDown, true)
		})
	})

	// --- View toggle (cards / table) on mobile ---
	const viewBtns = [...root.querySelectorAll('[data-dt-view]')]
	viewBtns.forEach((btn) => {
		const onClick = () => {
			const cards = btn.dataset.dtView === 'cards'
			table.classList.toggle('is-cards-view', cards)
			viewBtns.forEach((b) => {
				const on = b === btn
				b.classList.toggle('is-active', on)
				b.setAttribute('aria-pressed', on ? 'true' : 'false')
			})
		}
		btn.addEventListener('click', onClick)
		disposers.push(() => btn.removeEventListener('click', onClick))
	})

	// --- Public API for filter UIs ---
	root.__dataTable = {
		applyFilters(next = {}) {
			state = {
				query: norm(next.query),
				filters: Array.isArray(next.filters) ? next.filters : [],
			}
			recompute()
		},
		reset() {
			state = { query: '', filters: [] }
			recompute()
		},
	}

	recompute()

	// Let a filter UI that mounted first know the API is now available.
	document.dispatchEvent(new CustomEvent('datatable:ready', { detail: { root } }))

	return () => {
		disposers.forEach((d) => d())
		baseOrder.forEach((row) => tbody.appendChild(row))
		baseOrder.forEach((row) => row.classList.remove('is-hidden'))
		headers.forEach((h) => h.classList.remove('is-asc', 'is-desc'))
		delete root.__dataTable
		delete root.__dataTableBound
	}
}

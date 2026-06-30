import { mountStaticPagination, mountDataPagination } from '@/utils/pagination'
import { tableUrlEnabled, readTableUrl, writeTableUrl } from '@/utils/tableUrl'

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

// ---- JSON-driven build -----------------------------------------------------
const esc = (s) =>
	String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const alignCls = (align, base) =>
	align === 'center' ? ` ${base}--center` : align === 'num' ? ` ${base}--num` : ''

// render a single cell by the column's declared type
function cellHTML(col, row) {
	const v = row[col.key]
	switch (col.type) {
		case 'link':
			return `<a class="data-table__link" href="${esc(row[col.hrefKey] || '#')}">${esc(v)}</a>`
		case 'cat': {
			const k = String(v ?? '').toLowerCase() // class is lowercase (--a/--b/--c/--d), letter shown uppercase
			return `<span class="data-table__cat data-table__cat--${esc(k)}">${esc(k.toUpperCase())}</span>`
		}
		case 'trend':
			return `<span class="manager__trend manager__trend--${esc(v)}"><svg aria-hidden="true" focusable="false" viewBox="0 0 12 12"><path d="M2 7.5L6 3.5L10 7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>`
		case 'index':
			return `<span class="manager__index manager__index--${esc(row[col.trendKey] || '')}">${esc(v)}</span>`
		default:
			return esc(v)
	}
}

// one <td> (mobile card label baked in) + a full <tbody> — reused by the client
// build and by the server render that swaps rows on each fetch
function tdHTML(col, row) {
	const fAttr = col.filterKey ? ` data-filter-key="${esc(col.filterKey)}"` : ''
	const label = col.label ? ` data-label="${esc(col.label)}"` : ''
	return `<td class="data-table__td${alignCls(col.align, 'data-table__td')}"${fAttr}${label}>${cellHTML(col, row)}</td>`
}
function tbodyHTML(cols, rows) {
	return rows.map((row) => `<tr class="data-table__row">${cols.map((c) => tdHTML(c, row)).join('')}</tr>`).join('')
}

// build the full inner table (controls + table + footer) from a config blob.
// `empty` → empty <tbody> (server mode fills it per page via fetch)
function buildTable(root, config, empty) {
	const cols = Array.isArray(config.columns) ? config.columns : []
	const rows = empty ? [] : Array.isArray(config.rows) ? config.rows : []
	const sizes = config.pageSizes || (config.pageSize ? [config.pageSize] : [20, 50, 100])
	const pageSize = config.pageSize || sizes[0] || 20

	const thead = cols
		.map((c) => {
			const sortAttr = c.sort ? ` data-sort-key="${esc(c.key)}" data-sort-type="${esc(c.sort)}"` : ''
			return `<th class="data-table__th${alignCls(c.align, 'data-table__th')}"${sortAttr}>${esc(c.label || '')}</th>`
		})
		.join('')

	const tbody = tbodyHTML(cols, rows)

	const sortOpts = ['<button type="button" class="data-table__sort-option is-active" role="option" data-sort="default">По умолчанию</button>']
	cols
		.filter((c) => c.sort)
		.forEach((c) => {
			sortOpts.push(`<button type="button" class="data-table__sort-option" role="option" data-sort="${esc(c.key)}" data-dir="asc">${esc(c.label)} ↑</button>`)
			sortOpts.push(`<button type="button" class="data-table__sort-option" role="option" data-sort="${esc(c.key)}" data-dir="desc">${esc(c.label)} ↓</button>`)
		})
	const controls = `<div class="data-table__controls"><div class="data-table__sort" data-dt-sort><button type="button" class="data-table__sort-trigger" data-dt-sort-trigger aria-haspopup="listbox" aria-expanded="false"><span data-dt-sort-value>По умолчанию</span><svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-caret"></use></svg></button><div class="data-table__sort-panel" data-dt-sort-panel role="listbox" aria-hidden="true">${sortOpts.join('')}</div></div><button type="button" class="data-table__ctrl is-active" data-dt-view="cards" aria-label="Карточки" aria-pressed="true"><svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="4" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg></button><button type="button" class="data-table__ctrl" data-dt-view="table" aria-label="Таблица" aria-pressed="false"><svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/></svg></button></div>`

	const pageSizeOpts = sizes
		.map((s) => `<button type="button" class="page-size__option${s === pageSize ? ' is-active' : ''}" role="option" data-value="${s}">${s}</button>`)
		.join('')
	const footer = `<div class="data-table__footer"><nav class="ui-pagination" aria-label="Страницы"></nav><div class="data-table__total"><span class="data-table__total-text">Всего: <span data-total>${esc(config.total ?? rows.length)}</span></span><div class="page-size" data-page-size><button type="button" class="page-size__trigger" data-page-size-trigger aria-haspopup="listbox" aria-expanded="false"><span data-page-size-value>${pageSize}</span><svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-caret"></use></svg></button><div class="page-size__panel" data-page-size-panel role="listbox" aria-hidden="true">${pageSizeOpts}</div></div></div></div>`

	const tableCls = `data-table is-cards-view${config.table ? ' ' + esc(config.table) : ''}`
	const wrap = document.createElement('div')
	wrap.innerHTML = `${controls}<div class="data-table__scroll"><table class="${tableCls}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table><div class="data-table__empty" data-table-empty hidden>Ничего не найдено</div></div>${footer}`
	while (wrap.firstChild) root.appendChild(wrap.firstChild)
}

// config comes from an inline <script data-table-data> OR a data-table-src URL
async function resolveConfig(root) {
	const src = root.dataset.tableSrc
	if (src) {
		try {
			const r = await fetch(src, { headers: { Accept: 'application/json' } })
			return await r.json()
		} catch (err) {
			console.warn('[DataTable] failed to load config from', src, err)
			return null
		}
	}
	const el = root.querySelector('[data-table-data]')
	if (el) {
		try {
			return JSON.parse(el.textContent)
		} catch (err) {
			console.warn('[DataTable] invalid data-table-data JSON', err)
			return null
		}
	}
	return null
}

export default async (root) => {
	if (!root || root.__dataTableBound) return
	root.__dataTableBound = true

	// JSON-driven mode: build the table from a config blob. mode:"server" → rows
	// are fetched per page from config.endpoint; otherwise everything is in `rows`.
	// While the config is fetched (data-table-src), show a loader so the panel
	// keeps its height instead of collapsing to nothing.
	let loaderEl = null
	if (root.dataset.tableSrc) {
		loaderEl = document.createElement('div')
		loaderEl.className = 'data-table__loader'
		loaderEl.innerHTML =
			'<span class="data-table__spinner" aria-hidden="true"></span><span class="data-table__loader-text">Загрузка данных…</span>'
		root.appendChild(loaderEl)
	}
	const config = await resolveConfig(root)
	loaderEl?.remove()
	if (root.dataset.tableSrc && !config) {
		const err = document.createElement('div')
		err.className = 'data-table__loader data-table__loader--error'
		err.textContent = 'Не удалось загрузить данные'
		root.appendChild(err)
	}
	const serverMode = config?.mode === 'server'
	if (config) buildTable(root, config, serverMode)
	const dataMode = !!config
	const cols = config?.columns || []
	let reqId = 0

	const table = root.querySelector('table')
	const tbody = table?.querySelector('tbody')
	if (!table || !tbody) {
		delete root.__dataTableBound
		return
	}

	const emptyEl = root.querySelector('[data-table-empty]')
	// empty state: hide the table (no lone headers) and show a tidy centered notice
	const showEmpty = (visible, msg) => {
		if (emptyEl) {
			if (msg) emptyEl.textContent = msg
			emptyEl.hidden = !visible
		}
		table.classList.toggle('is-empty', visible)
	}
	// "Нет данных" when the dataset is empty, "Ничего не найдено" when a filter cleared it
	const emptyMsg = () => (state.query || state.filters.length ? 'Ничего не найдено' : 'Нет данных')
	const headers = [...table.querySelectorAll('th[data-sort-key]')]
	const allRows = [...tbody.querySelectorAll('tr')]
	const baseOrder = allRows.slice()
	const disposers = []
	const totalEl = root.querySelector('[data-total]')

	let state = { query: '', filters: [] }
	let sort = { key: null, dir: 0, type: 'text', th: null } // dir: 1 asc, -1 desc, 0 none
	let pageSize = dataMode ? config.pageSize || Infinity : Infinity
	let currentPage = 1

	// Shareable URL state (sole client table only). One writer — syncUrl — runs at
	// the end of every recompute, so every change (filter/sort/page/size) is captured.
	const urlEnabled = tableUrlEnabled() && !serverMode
	const serializeFilters = (arr) => arr.map((x) => `${x.key}=${x.value}`).sort().join('&')
	const syncUrl = () => {
		if (!urlEnabled) return
		writeTableUrl({
			query: state.query,
			filters: state.filters,
			sort,
			page: dataMode ? currentPage : 1,
			size: dataMode ? pageSize : null,
		})
	}

	// pagination: real (data mode → navigates the dataset) or visual (static demo)
	const pagNav = root.querySelector('.ui-pagination')
	let dataPag = null
	if (pagNav) {
		if (dataMode) {
			dataPag = mountDataPagination(pagNav, (p) => {
				currentPage = p
				recompute()
			})
			disposers.push(() => dataPag.dispose())
		} else {
			const disposePag = mountStaticPagination(pagNav)
			if (disposePag) disposers.push(disposePag)
		}
	}

	// resolve a filter key to the cell holding its value: a td tagged with
	// data-filter-key, else the column under the matching sortable header
	const colIndexForKey = (key) => {
		const th = table.querySelector(`th[data-sort-key="${key}"]`)
		return th ? [...th.parentElement.children].indexOf(th) : -1
	}
	const cellForKey = (row, key) => {
		const tagged = row.querySelector(`[data-filter-key="${key}"]`)
		if (tagged) return tagged
		const ci = colIndexForKey(key)
		return ci >= 0 ? row.children[ci] : null
	}
	// "1,31" / "1 234" → 1.31 / 1234 ; "10.05.2026" → timestamp
	const toNum = (s) => {
		const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'))
		return Number.isNaN(v) ? null : v
	}
	const toDate = (s) => {
		const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s))
		return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null
	}

	const matches = (row) => {
		if (state.query && !norm(row.textContent).includes(state.query)) return false
		// group active filters by key → OR within a key, AND across keys
		const byKey = new Map()
		for (const f of state.filters) {
			if (!byKey.has(f.key)) byKey.set(f.key, [])
			byKey.get(f.key).push(f)
		}
		for (const [key, fs] of byKey) {
			const cell = cellForKey(row, key)
			const ranges = fs.filter((f) => f.range)
			// numeric / date From–To range → compare the cell value to [from, to]
			if (ranges.length) {
				if (!cell) continue // no matching column (e.g. a demo date field) → skip
				const raw = cell.textContent
				const ok = ranges.some(({ range }) => {
					const isDate = /\d{2}\.\d{2}\.\d{4}/.test(`${range.from}${range.to}`)
					const v = isDate ? toDate(raw) : toNum(raw)
					if (v == null) return false
					const lo = isDate ? toDate(range.from) : toNum(range.from)
					const hi = isDate ? toDate(range.to) : toNum(range.to)
					return (lo == null || v >= lo) && (hi == null || v <= hi)
				})
				if (!ok) return false
				continue
			}
			// text / select filters (OR within a key); free-text lists split on commas
			const text = cell ? norm(cell.textContent) : norm(row.textContent)
			const ok = fs.some((f) =>
				f.list
					? String(f.value).split(/[,\s]+/).map(norm).filter(Boolean).some((t) => text.includes(t))
					: text.includes(norm(f.value))
			)
			if (!ok) return false
		}
		return true
	}

	// server mode: fetch the current page slice (sort/filter/page → query params)
	async function loadServer() {
		const id = ++reqId
		root.classList.add('is-loading')
		const params = new URLSearchParams()
		params.set('page', String(currentPage))
		params.set('pageSize', pageSize === Infinity ? '0' : String(pageSize))
		if (sort.key && sort.dir) {
			params.set('sort', sort.key)
			params.set('dir', sort.dir > 0 ? 'asc' : 'desc')
		}
		if (state.query) params.set('q', state.query)
		if (state.filters.length) params.set('filters', JSON.stringify(state.filters))
		try {
			const sep = config.endpoint.includes('?') ? '&' : '?'
			const res = await fetch(config.endpoint + sep + params.toString(), { headers: { Accept: 'application/json' } })
			const data = await res.json()
			if (id !== reqId) return // a newer request superseded this one
			const rows = Array.isArray(data.rows) ? data.rows : []
			const total = Number(data.total) || rows.length
			tbody.innerHTML = tbodyHTML(cols, rows)
			showEmpty(rows.length === 0, emptyMsg())
			const size = pageSize === Infinity ? total || 1 : pageSize
			const totalPages = Math.max(1, Math.ceil(total / size))
			if (currentPage > totalPages) currentPage = totalPages
			dataPag?.render(totalPages, currentPage)
			if (totalEl) totalEl.textContent = String(total)
		} catch (err) {
			if (id !== reqId) return
			console.warn('[DataTable] server load failed', err)
			tbody.innerHTML = ''
			showEmpty(true, 'Ошибка загрузки')
		} finally {
			if (id === reqId) root.classList.remove('is-loading')
		}
	}

	function recompute() {
		if (serverMode) {
			loadServer()
			return
		}
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

		if (dataMode) {
			// Windowed render: keep ONLY the current page's rows in the DOM.
			// The rest stay detached in `baseOrder` (memory only — never laid out),
			// so thousands of rows load, sort and filter without a render freeze.
			const size = pageSize === Infinity ? matched.length || 1 : pageSize
			const totalPages = Math.max(1, Math.ceil((matched.length || 1) / size))
			if (currentPage > totalPages) currentPage = totalPages
			const start = (currentPage - 1) * size
			const pageRows = matched.slice(start, start + size)
			pageRows.forEach((row) => row.classList.remove('is-hidden'))
			tbody.replaceChildren(...pageRows)
			dataPag?.render(totalPages, currentPage)
			if (totalEl) totalEl.textContent = String(matched.length)
		} else {
			// static mode: reorder in place, cap to page-size (no real navigation)
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
		}

		showEmpty(matched.length === 0, emptyMsg())
		syncUrl()
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
			currentPage = 1
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
			currentPage = 1
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
	// In data mode the labels are baked into each cell at build time, so we skip
	// this O(rows×cols) pass (it would touch every detached row, thousands of them).
	const headerLabels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
	if (!dataMode) {
		allRows.forEach((row) => {
			;[...row.children].forEach((td, i) => {
				if (headerLabels[i]) td.setAttribute('data-label', headerLabels[i])
			})
		})
	}

	// programmatic sort used by the mobile "Сортировать по" dropdown
	const sortByKey = (key, dir, silent) => {
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
		if (silent) return // restoring from URL — caller does the single recompute
		currentPage = 1
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

	// in server mode, debounce live filter/search input so we don't hit the
	// endpoint on every keystroke (page/sort clicks stay immediate)
	let filterTimer = null
	const recomputeFiltered = () => {
		if (!serverMode) return recompute()
		clearTimeout(filterTimer)
		filterTimer = setTimeout(recompute, 300)
	}
	disposers.push(() => clearTimeout(filterTimer))

	// --- Public API for filter UIs ---
	root.__dataTable = {
		applyFilters(next = {}) {
			const q = norm(next.query)
			const f = Array.isArray(next.filters) ? next.filters : []
			// only jump back to page 1 when the filter set actually changed — keeps a
			// page restored from the URL from being reset by the header's re-apply
			const changed = q !== state.query || serializeFilters(f) !== serializeFilters(state.filters)
			state = { query: q, filters: f }
			if (changed) currentPage = 1
			recomputeFiltered()
		},
		reset() {
			state = { query: '', filters: [] }
			currentPage = 1
			recompute()
		},
	}

	// --- Restore state from a shared URL (sole client table only) ---
	if (urlEnabled && location.search) {
		const u = readTableUrl()
		state = { query: norm(u.query), filters: u.filters }
		if (u.sort) sortByKey(u.sort.key, u.sort.dir < 0 ? 'desc' : 'asc', true)
		if (dataMode) {
			if (u.size) {
				pageSize = u.size
				root.querySelectorAll('[data-page-size]').forEach((sel) => {
					const valueEl = sel.querySelector('[data-page-size-value]')
					if (valueEl) valueEl.textContent = String(u.size)
					sel.querySelectorAll('.page-size__option').forEach((o) =>
						o.classList.toggle('is-active', parseInt(o.dataset.value, 10) === u.size)
					)
				})
			}
			if (u.page > 1) currentPage = u.page // set last — sort/size resets would clobber it
		}
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

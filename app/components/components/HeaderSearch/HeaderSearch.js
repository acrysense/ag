import { mountDateRange } from '@/utils/dateRange'
import { tableUrlEnabled, readTableUrl } from '@/utils/tableUrl'

// Reusable header search + filter dropdown. Drives a [data-data-table] via its
// public __dataTable API (employees), or filters task rows directly (tasks).
// Opt-in per page: only activates when the page sets <body data-header-search>.
// The panel shows the field group for the current page ([data-page-fields]).
//
// Contract (markup):
//   .filter-search                       module root
//     [data-filter-input]                live header search input
//     [data-filter-dropdown]             floating filter panel
//       .filter-field[data-filter-key]   custom select (add [data-multi] for checkboxes + search)
//       [data-filter-apply] / [data-filter-reset]
//   [data-filter-chips] (anywhere on page)
//     [data-filter-chips-list] / [data-filter-reset-all]

export default (root) => {
	if (!root || root.__headerSearchBound) return
	// Opt-in gate — keep other pages completely untouched.
	if (!document.body.hasAttribute('data-header-search')) return
	root.__headerSearchBound = true

	const input = root.querySelector('[data-filter-input]')
	const dropdown = root.querySelector('[data-filter-dropdown]')
	const applyBtn = root.querySelector('[data-filter-apply]')
	const resetBtn = root.querySelector('[data-filter-reset]')

	// show only the field group for the current page; the other group stays in
	// the DOM (hidden via CSS) but is never read
	const page = document.body.classList.contains('tasks-page') ? 'tasks' : 'employees'
	const fields = [...root.querySelectorAll(`[data-page-fields="${page}"] .filter-field`)]

	const chipsHost = document.querySelector('[data-filter-chips]')
	const chipsList = chipsHost?.querySelector('[data-filter-chips-list]')
	const resetAllBtn = chipsHost?.querySelector('[data-filter-reset-all]')
	// a page may hold several data tables (e.g. tabs) — drive them all
	const tables = [...document.querySelectorAll('[data-data-table]')]

	const disposers = []
	let filters = [] // [{ key, value, label }]

	const parseDmy = (s) => {
		const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s))
		return m ? new Date(+m[3], +m[2] - 1, +m[1]).setHours(0, 0, 0, 0) : null
	}
	// Tasks page has no data-table — filter the visible task rows in place,
	// per list, and show an empty-state row when a filter hides everything.
	function applyTaskFilter(query, list) {
		const lists = document.querySelectorAll('.tasks-list')
		if (!lists.length) return
		const q = query.trim().toLowerCase()
		const assignees = list.filter((f) => f.key === 'assignee').map((f) => f.value.toLowerCase())
		const date = list.find((f) => f.key === 'date' && f.range)
		const from = date ? parseDmy(date.range.from) : null
		const to = date ? parseDmy(date.range.to) : null
		const active = !!q || assignees.length > 0 || (from != null && to != null)

		lists.forEach((ul) => {
			const rows = [...ul.querySelectorAll('.task-row')]
			rows.forEach((row) => {
				const who = (row.querySelector('.task-row__assignee')?.textContent || '').toLowerCase()
				const when = parseDmy(row.querySelector('.task-row__date')?.textContent || '')
				let ok = true
				if (q && !row.textContent.toLowerCase().includes(q)) ok = false
				if (ok && assignees.length && !assignees.some((a) => who.includes(a))) ok = false
				if (ok && from != null && to != null && (when == null || when < from || when > to)) ok = false
				row.classList.toggle('is-filtered-out', !ok)
			})

			const anyVisible = rows.some(
				(r) => !r.classList.contains('is-filtered-out') && !r.classList.contains('is-hidden')
			)
			const emptyByFilter = active && !anyVisible
			let empty = ul.querySelector('.tasks-list__empty--filter')
			if (emptyByFilter) {
				if (!empty) {
					empty = document.createElement('li')
					empty.className = 'tasks-list__empty tasks-list__empty--filter'
					empty.textContent = 'Задачи по фильтру не найдены'
					ul.appendChild(empty)
				}
				empty.hidden = false
			} else if (empty) {
				empty.hidden = true
			}

			// hide the "show completed" toggle while the filter empties this list
			// (TasksPanel owns its [hidden] attribute; we use a separate class)
			const toggleBtn = ul.closest('.tasks-panel')?.querySelector('[data-tasks-toggle]')
			toggleBtn?.classList.toggle('is-filter-hidden', emptyByFilter)
		})
	}

	const tableApis = () => tables.map((t) => t.__dataTable).filter(Boolean)
	const apply = () => {
		const apis = tableApis()
		if (apis.length) apis.forEach((api) => api.applyFilters({ query: input?.value || '', filters }))
		else applyTaskFilter(input?.value || '', filters)
		renderChips()
	}

	// ---- chips ----
	function renderChips() {
		if (!chipsHost || !chipsList) return
		chipsList.innerHTML = ''
		filters.forEach((f, i) => {
			const chip = document.createElement('button')
			chip.type = 'button'
			chip.className = 'filter-chip'
			chip.dataset.index = String(i)
			chip.innerHTML = `<span>${f.label}</span><svg aria-hidden="true" focusable="false" width="10" height="10"><use href="#icon-close-thin"></use></svg>`
			chipsList.appendChild(chip)
		})
		chipsHost.hidden = filters.length === 0
	}

	const onChipClick = (e) => {
		const chip = e.target.closest('.filter-chip')
		if (!chip) return
		const value = filters[+chip.dataset.index]
		filters = filters.filter((f) => f !== value)
		syncFieldsFromFilters()
		apply()
	}
	const onResetAll = () => {
		filters = []
		if (input) input.value = ''
		fields.forEach(clearField)
		apply()
	}

	// ---- field (custom select) helpers ----
	function readField(field) {
		const key = field.dataset.filterKey
		// calendar fields: date range and single date both read from __dateRange
		if (field.hasAttribute('data-daterange') || field.hasAttribute('data-date')) {
			const r = field.__dateRange?.getRange()
			if (!r) return []
			const label = r.from === r.to ? r.from : `${r.from} – ${r.to}`
			return [{ key, value: `${r.from}|${r.to}`, label, range: r }]
		}
		// free-text input (e.g. a list of values)
		if (field.hasAttribute('data-input')) {
			const v = field.querySelector('[data-filter-text]')?.value.trim() || ''
			return v ? [{ key, value: v, label: v, list: true }] : []
		}
		// numeric From–To range
		if (field.hasAttribute('data-range')) {
			const from = field.querySelector('[data-range-from]')?.value.trim() || ''
			const to = field.querySelector('[data-range-to]')?.value.trim() || ''
			if (!from && !to) return []
			const label = from && to ? `От ${from} до ${to}` : from ? `От ${from}` : `До ${to}`
			return [{ key, value: `${from}|${to}`, label, range: { from, to } }]
		}
		const multi = field.hasAttribute('data-multi')
		if (multi) {
			return [...field.querySelectorAll('.filter-option__input:checked')].map((cb) => ({
				key,
				value: cb.value || cb.dataset.value,
				label: cb.dataset.label || cb.value,
			}))
		}
		const active = field.querySelector('.filter-option.is-active')
		if (!active || !active.dataset.value) return []
		return [{ key, value: active.dataset.value, label: active.dataset.label || active.dataset.value }]
	}
	// reflect whether a select holds a chosen value (vs its placeholder), so the
	// trigger label can be greyed (placeholder) or black (value) via .is-filled
	function reflectFilled(field) {
		const lbl = field.querySelector('.filter-field__value')
		if (!lbl) return
		const txt = lbl.textContent.trim()
		field.classList.toggle('is-filled', txt !== '' && txt !== (lbl.dataset.placeholder || '').trim())
	}
	// inline chips under a multiselect trigger — a duplicate of the page chips so
	// the chosen values can be removed without leaving the filter
	function renderFieldChips(field) {
		if (!field.hasAttribute('data-multi')) return
		let host = field.querySelector('.filter-field__chips')
		if (!host) {
			host = document.createElement('div')
			host.className = 'filter-field__chips'
			field.appendChild(host)
		}
		const checked = [...field.querySelectorAll('.filter-option__input:checked')]
		host.innerHTML = ''
		host.hidden = checked.length === 0
		checked.forEach((cb) => {
			const chip = document.createElement('button')
			chip.type = 'button'
			chip.className = 'filter-chip filter-chip--inline'
			chip.dataset.value = cb.value
			chip.innerHTML = `<span>${cb.dataset.label || cb.value}</span><svg aria-hidden="true" focusable="false" width="10" height="10"><use href="#icon-close-thin"></use></svg>`
			host.appendChild(chip)
		})
	}
	function clearField(field) {
		field.querySelectorAll('.filter-option__input').forEach((cb) => (cb.checked = false))
		field.querySelectorAll('.filter-option.is-active').forEach((o) => o.classList.remove('is-active'))
		field.querySelectorAll('[data-filter-text], [data-range-from], [data-range-to]').forEach((i) => (i.value = ''))
		const label = field.querySelector('.filter-field__value')
		if (label) label.textContent = label.dataset.placeholder || ''
		field.classList.remove('is-open')
		reflectFilled(field)
		renderFieldChips(field)
		field.__reorder?.()
		field.__dateRange?.clear()
	}
	function syncFieldsFromFilters() {
		// keep multiselect checkboxes in step when a chip is removed
		fields.forEach((field) => {
			const key = field.dataset.filterKey
			if (field.hasAttribute('data-daterange') || field.hasAttribute('data-date')) {
				if (!filters.some((f) => f.key === key)) field.__dateRange?.clear()
				return
			}
			if (field.hasAttribute('data-input') || field.hasAttribute('data-range')) {
				if (!filters.some((f) => f.key === key)) {
					field.querySelectorAll('[data-filter-text], [data-range-from], [data-range-to]').forEach((i) => (i.value = ''))
					const lbl = field.querySelector('.filter-field__value')
					if (lbl) lbl.textContent = lbl.dataset.placeholder || ''
				}
				return
			}
			const active = new Set(filters.filter((f) => f.key === key).map((f) => f.value))
			field.querySelectorAll('.filter-option__input').forEach((cb) => {
				cb.checked = active.has(cb.value || cb.dataset.value)
			})
			field.querySelectorAll('.filter-option[data-value]').forEach((o) => {
				o.classList.toggle('is-active', active.has(o.dataset.value))
			})
			field.__reorder?.()
		})
		fields.forEach((f) => {
			reflectFilled(f)
			renderFieldChips(f)
		})
	}

	// collect every filter field (incl. "Сотрудник") into the filter list
	function collectFilters() {
		const next = []
		fields.forEach((field) => next.push(...readField(field)))
		// drop duplicate key+value (a page may hold two fields for the same key)
		const seen = new Set()
		filters = next.filter((f) => {
			const id = `${f.key} ${f.value}`
			if (seen.has(id)) return false
			seen.add(id)
			return true
		})
	}

	// ---- per-field dropdown open/close + selection ----
	fields.forEach((field) => {
		const trigger = field.querySelector('.filter-field__trigger')
		const labelEl = field.querySelector('.filter-field__value')
		const panel = field.querySelector('.filter-field__panel')
		const multi = field.hasAttribute('data-multi')

		// calendar fields (date range / single date): a calendar handles
		// selection; just wire open/close. single date closes after one pick.
		if (field.hasAttribute('data-daterange') || field.hasAttribute('data-date')) {
			disposers.push(mountDateRange(field, () => reflectFilled(field), { single: field.hasAttribute('data-date') }))
			const onTrigger = (e) => {
				e.preventDefault()
				e.stopPropagation()
				const willOpen = !field.classList.contains('is-open')
				fields.forEach((f) => f !== field && f.classList.remove('is-open'))
				field.classList.toggle('is-open', willOpen)
			}
			trigger?.addEventListener('click', onTrigger)
			disposers.push(() => trigger?.removeEventListener('click', onTrigger))
			return
		}

		// Multi fields get an in-dropdown search + a scrollable options box.
		// Inject them if the markup didn't provide them (Аптека already has both).
		let optionsBox = panel?.querySelector('.filter-field__options')
		let search = panel?.querySelector('.filter-field__search')
		if (multi && panel) {
			if (!optionsBox) {
				optionsBox = document.createElement('div')
				optionsBox.className = 'filter-field__options'
				;[...panel.children].forEach((c) => {
					if (c !== search) optionsBox.appendChild(c)
				})
				panel.appendChild(optionsBox)
			}
			if (!search) {
				search = document.createElement('input')
				search.type = 'text'
				search.className = 'filter-field__search'
				search.placeholder = 'Найти'
				search.autocomplete = 'off'
				panel.insertBefore(search, optionsBox)
			}
		}
		const optsRoot = optionsBox || field

		const setLabel = () => {
			if (!labelEl || !multi) return
			const n = field.querySelectorAll('.filter-option__input:checked').length
			labelEl.textContent = n ? `${labelEl.dataset.placeholder || ''}: ${n}` : labelEl.dataset.placeholder || ''
			reflectFilled(field)
		}

		const isOn = (o) => !!o.querySelector('.filter-option__input')?.checked
		// the divider only shows when there are BOTH visible checked and visible
		// unchecked options — hide it if search/selection empties either side
		const updateDivider = () => {
			if (!optionsBox) return
			const div = optionsBox.querySelector('.filter-field__divider')
			if (!div) return
			const vis = [...optionsBox.querySelectorAll('.filter-option')].filter((o) => o.style.display !== 'none')
			div.style.display = vis.some(isOn) && vis.some((o) => !isOn(o)) ? '' : 'none'
		}

		// raise checked options to the top, divide them from the unchecked rest
		const reorder = () => {
			if (!multi || !optionsBox) return
			optionsBox.querySelector('.filter-field__divider')?.remove()
			const opts = [...optionsBox.querySelectorAll('.filter-option')]
			const on = opts.filter(isOn)
			const off = opts.filter((o) => !isOn(o))
			on.forEach((o) => optionsBox.appendChild(o))
			if (on.length && off.length) {
				const div = document.createElement('div')
				div.className = 'filter-field__divider'
				optionsBox.appendChild(div)
			}
			off.forEach((o) => optionsBox.appendChild(o))
			updateDivider()
		}
		field.__reorder = reorder

		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			const willOpen = !field.classList.contains('is-open')
			fields.forEach((f) => f !== field && f.classList.remove('is-open'))
			field.classList.toggle('is-open', willOpen)
		}
		trigger?.addEventListener('click', onTrigger)
		disposers.push(() => trigger?.removeEventListener('click', onTrigger))

		// free-text / numeric-range fields: reflect the typed value in the trigger
		if (field.hasAttribute('data-input') || field.hasAttribute('data-range')) {
			const onFieldInput = () => {
				const f = readField(field)
				if (labelEl) labelEl.textContent = f.length ? f[0].label : labelEl.dataset.placeholder || ''
			}
			field.addEventListener('input', onFieldInput)
			disposers.push(() => field.removeEventListener('input', onFieldInput))
		}

		// single-select: <button> options (no native toggle, handle on click)
		const onOption = (e) => {
			if (multi) return
			const option = e.target.closest('.filter-option')
			if (!option) return
			field.querySelectorAll('.filter-option').forEach((o) => o.classList.remove('is-active'))
			option.classList.add('is-active')
			if (labelEl) labelEl.textContent = option.dataset.label || option.dataset.value
			reflectFilled(field)
			field.classList.remove('is-open')
		}
		field.addEventListener('click', onOption)
		disposers.push(() => field.removeEventListener('click', onOption))

		// multi-select: <label> options toggle natively → react on change
		if (multi) {
			const onChange = (e) => {
				if (!e.target.matches('.filter-option__input')) return
				setLabel()
				reorder()
				renderFieldChips(field)
			}
			field.addEventListener('change', onChange)
			disposers.push(() => field.removeEventListener('change', onChange))
		}

		if (search) {
			const onSearch = () => {
				const q = search.value.trim().toLowerCase()
				optsRoot.querySelectorAll('.filter-option').forEach((o) => {
					o.style.display = o.textContent.toLowerCase().includes(q) ? '' : 'none'
				})
				updateDivider()
			}
			search.addEventListener('input', onSearch)
			disposers.push(() => search.removeEventListener('input', onSearch))
		}

		setLabel()
		reorder()
		renderFieldChips(field)
	})

	// ---- header dropdown open/close ----
	const mqMobile = window.matchMedia('(max-width: 743.98px)')
	let open = false
	const setOpen = (s) => {
		open = s
		root.classList.toggle('is-open', s)
		if (dropdown) dropdown.setAttribute('aria-hidden', s ? 'false' : 'true')
		// lock the page scroll behind the full-screen filter (mobile)
		if (mqMobile.matches) document.documentElement.style.overflow = s ? 'hidden' : ''
		if (!s) fields.forEach((f) => f.classList.remove('is-open'))
	}
	const onInputFocus = () => setOpen(true)
	const onDocDown = (e) => {
		if (open && !root.contains(e.target)) {
			setOpen(false)
			fields.forEach((f) => f.classList.remove('is-open'))
		}
	}
	const onKey = (e) => {
		if (open && e.key === 'Escape') {
			setOpen(false)
			fields.forEach((f) => f.classList.remove('is-open'))
			input?.blur()
		}
	}
	const onInput = () => apply() // live search

	input?.addEventListener('focus', onInputFocus)
	input?.addEventListener('input', onInput)
	document.addEventListener('pointerdown', onDocDown, true)
	document.addEventListener('keydown', onKey, true)
	disposers.push(() => {
		input?.removeEventListener('focus', onInputFocus)
		input?.removeEventListener('input', onInput)
		document.removeEventListener('pointerdown', onDocDown, true)
		document.removeEventListener('keydown', onKey, true)
	})

	// --- Mobile chrome: "Фильтр" close button + per-field bottom-sheet bits ---
	const filterClose = root.querySelector('[data-filter-close]')
	const onFilterClose = () => setOpen(false)
	filterClose?.addEventListener('click', onFilterClose)
	disposers.push(() => filterClose?.removeEventListener('click', onFilterClose))

	// give each field-with-a-panel a drag handle + Применить/Закрыть so it reads
	// as a bottom sheet on mobile (hidden on desktop via CSS). Calendar panels
	// are skipped — mountDateRange owns their innerHTML.
	fields.forEach((field) => {
		const panel = field.querySelector('.filter-field__panel')
		if (!panel || panel.classList.contains('filter-field__panel--calendar')) return
		if (panel.querySelector('.filter-field__sheet-actions')) return
		const handle = document.createElement('div')
		handle.className = 'filter-field__sheet-head'
		panel.insertBefore(handle, panel.firstChild)
		const acts = document.createElement('div')
		acts.className = 'filter-field__sheet-actions'
		acts.innerHTML =
			'<button type="button" class="btn btn--sm" data-field-apply>Применить</button>' +
			'<button type="button" class="btn btn--sm btn--secondary" data-field-close>Закрыть</button>'
		panel.appendChild(acts)
	})
	// close a field sheet via its buttons, or by tapping the dimmed backdrop
	// (the open field's ::before — a click there lands on the field element)
	const onFieldSheet = (e) => {
		// remove a chosen value via its inline chip under the multiselect trigger
		const fieldChip = e.target.closest('.filter-field__chips .filter-chip')
		if (fieldChip) {
			e.preventDefault()
			const f = fieldChip.closest('.filter-field')
			const cb = [...f.querySelectorAll('.filter-option__input')].find((c) => c.value === fieldChip.dataset.value)
			if (cb) {
				cb.checked = false
				cb.dispatchEvent(new Event('change', { bubbles: true }))
			}
			return
		}
		if (e.target.closest('[data-field-apply], [data-field-close]')) {
			e.preventDefault()
			e.target.closest('.filter-field')?.classList.remove('is-open')
			return
		}
		const field = e.target.closest('.filter-field')
		if (field && field.classList.contains('is-open') && e.target === field) {
			field.classList.remove('is-open')
		}
	}
	root.addEventListener('click', onFieldSheet)
	disposers.push(() => root.removeEventListener('click', onFieldSheet))

	const onApply = (e) => {
		e.preventDefault()
		collectFilters()
		setOpen(false)
		fields.forEach((f) => f.classList.remove('is-open'))
		apply()
	}
	const onReset = (e) => {
		e.preventDefault()
		fields.forEach(clearField)
		filters = []
		apply()
	}
	applyBtn?.addEventListener('click', onApply)
	resetBtn?.addEventListener('click', onReset)
	chipsList?.addEventListener('click', onChipClick)
	resetAllBtn?.addEventListener('click', onResetAll)
	disposers.push(() => {
		applyBtn?.removeEventListener('click', onApply)
		resetBtn?.removeEventListener('click', onReset)
		chipsList?.removeEventListener('click', onChipClick)
		resetAllBtn?.removeEventListener('click', onResetAll)
	})

	// Re-apply once the table signals readiness (handles either mount order).
	const onTableReady = () => apply()
	document.addEventListener('datatable:ready', onTableReady)
	disposers.push(() => document.removeEventListener('datatable:ready', onTableReady))

	// reflect filters from a shared URL back into the field widgets, then let
	// collectFilters() rebuild the list (with proper labels) from them
	function restoreFromUrl() {
		const u = readTableUrl()
		if (input) input.value = u.query
		fields.forEach((field) => {
			const key = field.dataset.filterKey
			const mine = u.filters.filter((f) => f.key === key)
			if (field.hasAttribute('data-input')) {
				const inp = field.querySelector('[data-filter-text]')
				if (inp) inp.value = mine[0]?.value || ''
			} else if (field.hasAttribute('data-range')) {
				const r = mine[0]?.range || {}
				const from = field.querySelector('[data-range-from]')
				const to = field.querySelector('[data-range-to]')
				if (from) from.value = r.from || ''
				if (to) to.value = r.to || ''
			} else if (!field.hasAttribute('data-daterange') && !field.hasAttribute('data-date')) {
				const vals = new Set(mine.map((f) => f.value))
				field.querySelectorAll('.filter-option__input').forEach((cb) => {
					cb.checked = vals.has(cb.value || cb.dataset.value)
				})
				field.querySelectorAll('.filter-option[data-value]').forEach((o) => {
					o.classList.toggle('is-active', vals.has(o.dataset.value))
				})
				const labelEl = field.querySelector('.filter-field__value')
				if (labelEl) {
					if (field.hasAttribute('data-multi')) {
						const n = field.querySelectorAll('.filter-option__input:checked').length
						labelEl.textContent = n ? `${labelEl.dataset.placeholder || ''}: ${n}` : labelEl.dataset.placeholder || ''
					} else {
						const active = field.querySelector('.filter-option.is-active')
						labelEl.textContent = active ? active.dataset.label || active.dataset.value : labelEl.dataset.placeholder || ''
					}
				}
			}
			if (field.hasAttribute('data-input') || field.hasAttribute('data-range')) {
				const f = readField(field)
				const labelEl = field.querySelector('.filter-field__value')
				if (labelEl) labelEl.textContent = f.length ? f[0].label : labelEl.dataset.placeholder || ''
			}
			field.__reorder?.()
			reflectFilled(field)
			renderFieldChips(field)
		})
		collectFilters() // rebuild the filter list from the restored fields
	}

	// ---- initial state: restore from a shared URL, else seed from markup ----
	if (tableUrlEnabled() && location.search) restoreFromUrl()
	else collectFilters()
	apply()

	return () => {
		disposers.forEach((d) => d())
		setOpen(false)
		delete root.__headerSearchBound
	}
}

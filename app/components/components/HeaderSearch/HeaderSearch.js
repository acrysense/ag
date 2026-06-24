import { mountDateRange } from '@/utils/dateRange'

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
	const table = document.querySelector('[data-data-table]')

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

	const tableApi = () => table && table.__dataTable
	const apply = () => {
		const api = tableApi()
		if (api) api.applyFilters({ query: input?.value || '', filters })
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
		if (field.hasAttribute('data-daterange')) {
			const r = field.__dateRange?.getRange()
			if (!r) return []
			const label = r.from === r.to ? r.from : `${r.from} – ${r.to}`
			return [{ key, value: `${r.from}|${r.to}`, label, range: r }]
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
	function clearField(field) {
		field.querySelectorAll('.filter-option__input').forEach((cb) => (cb.checked = false))
		field.querySelectorAll('.filter-option.is-active').forEach((o) => o.classList.remove('is-active'))
		const label = field.querySelector('.filter-field__value')
		if (label) label.textContent = label.dataset.placeholder || ''
		field.classList.remove('is-open')
		field.__reorder?.()
		field.__dateRange?.clear()
	}
	function syncFieldsFromFilters() {
		// keep multiselect checkboxes in step when a chip is removed
		fields.forEach((field) => {
			const key = field.dataset.filterKey
			if (field.hasAttribute('data-daterange')) {
				if (!filters.some((f) => f.key === key)) field.__dateRange?.clear()
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
	}

	// collect every filter field (incl. "Сотрудник") into the filter list
	function collectFilters() {
		const next = []
		fields.forEach((field) => next.push(...readField(field)))
		filters = next
	}

	// ---- per-field dropdown open/close + selection ----
	fields.forEach((field) => {
		const trigger = field.querySelector('.filter-field__trigger')
		const labelEl = field.querySelector('.filter-field__value')
		const panel = field.querySelector('.filter-field__panel')
		const multi = field.hasAttribute('data-multi')

		// date-range field: a calendar handles selection; just wire open/close
		if (field.hasAttribute('data-daterange')) {
			disposers.push(mountDateRange(field))
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

		// single-select: <button> options (no native toggle, handle on click)
		const onOption = (e) => {
			if (multi) return
			const option = e.target.closest('.filter-option')
			if (!option) return
			field.querySelectorAll('.filter-option').forEach((o) => o.classList.remove('is-active'))
			option.classList.add('is-active')
			if (labelEl) labelEl.textContent = option.dataset.label || option.dataset.value
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
	})

	// ---- header dropdown open/close ----
	let open = false
	const setOpen = (s) => {
		open = s
		root.classList.toggle('is-open', s)
		if (dropdown) dropdown.setAttribute('aria-hidden', s ? 'false' : 'true')
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

	// ---- initial state: seed chips from any pre-checked / pre-active options ----
	collectFilters()
	apply()

	return () => {
		disposers.forEach((d) => d())
		setOpen(false)
		delete root.__headerSearchBound
	}
}

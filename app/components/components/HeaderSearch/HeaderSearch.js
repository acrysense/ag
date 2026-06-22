// Reusable header search + filter dropdown that drives a [data-data-table] via
// its public __dataTable API. Opt-in per page: only activates when the page sets
// <body data-header-search>. On other pages it renders hidden and binds nothing.
//
// Contract (markup):
//   .filter-search                       module root
//     [data-filter-input]                live header search input
//     [data-filter-dropdown]             floating filter panel
//       [data-filter-employee]           text field (maps to filter key "employee")
//       .filter-field[data-filter-key]   custom select (add [data-multi] for checkboxes)
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
	const employeeInput = root.querySelector('[data-filter-employee]')
	const applyBtn = root.querySelector('[data-filter-apply]')
	const resetBtn = root.querySelector('[data-filter-reset]')
	const fields = [...root.querySelectorAll('.filter-field')]

	const chipsHost = document.querySelector('[data-filter-chips]')
	const chipsList = chipsHost?.querySelector('[data-filter-chips-list]')
	const resetAllBtn = chipsHost?.querySelector('[data-filter-reset-all]')
	const table = document.querySelector('[data-data-table]')

	const disposers = []
	let filters = [] // [{ key, value, label }]

	const tableApi = () => table && table.__dataTable
	const apply = () => {
		tableApi()?.applyFilters({ query: input?.value || '', filters })
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
			chip.innerHTML = `<span>${f.label}</span><svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`
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
		if (employeeInput) employeeInput.value = ''
		fields.forEach(clearField)
		apply()
	}

	// ---- field (custom select) helpers ----
	function readField(field) {
		const key = field.dataset.filterKey
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
	}
	function syncFieldsFromFilters() {
		// keep multiselect checkboxes in step when a chip is removed
		fields.forEach((field) => {
			const key = field.dataset.filterKey
			const active = new Set(filters.filter((f) => f.key === key).map((f) => f.value))
			field.querySelectorAll('.filter-option__input').forEach((cb) => {
				cb.checked = active.has(cb.value || cb.dataset.value)
			})
			field.querySelectorAll('.filter-option[data-value]').forEach((o) => {
				o.classList.toggle('is-active', active.has(o.dataset.value))
			})
		})
	}

	// collect every field + the employee input into the filter list
	function collectFilters() {
		const next = []
		if (employeeInput && employeeInput.value.trim()) {
			next.push({ key: 'employee', value: employeeInput.value.trim(), label: employeeInput.value.trim() })
		}
		fields.forEach((field) => next.push(...readField(field)))
		filters = next
	}

	// ---- per-field dropdown open/close + selection ----
	fields.forEach((field) => {
		const trigger = field.querySelector('.filter-field__trigger')
		const labelEl = field.querySelector('.filter-field__value')
		const search = field.querySelector('.filter-field__search')
		const multi = field.hasAttribute('data-multi')

		const setLabel = () => {
			if (!labelEl) return
			if (multi) {
				const n = field.querySelectorAll('.filter-option__input:checked').length
				labelEl.textContent = n ? `${labelEl.dataset.placeholder || ''}: ${n}` : labelEl.dataset.placeholder || ''
			}
		}

		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			const willOpen = !field.classList.contains('is-open')
			fields.forEach((f) => f !== field && f.classList.remove('is-open'))
			field.classList.toggle('is-open', willOpen)
		}
		trigger?.addEventListener('click', onTrigger)
		disposers.push(() => trigger?.removeEventListener('click', onTrigger))

		const onOption = (e) => {
			const option = e.target.closest('.filter-option')
			if (!option) return
			if (multi) {
				const cb = option.querySelector('.filter-option__input')
				if (cb && !e.target.closest('.filter-option__input')) cb.checked = !cb.checked
				setLabel()
			} else {
				field.querySelectorAll('.filter-option').forEach((o) => o.classList.remove('is-active'))
				option.classList.add('is-active')
				if (labelEl) labelEl.textContent = option.dataset.label || option.dataset.value
				field.classList.remove('is-open')
			}
		}
		field.addEventListener('click', onOption)
		disposers.push(() => field.removeEventListener('click', onOption))

		if (search) {
			const onSearch = () => {
				const q = search.value.trim().toLowerCase()
				field.querySelectorAll('.filter-option').forEach((o) => {
					o.style.display = o.textContent.toLowerCase().includes(q) ? '' : 'none'
				})
			}
			search.addEventListener('input', onSearch)
			disposers.push(() => search.removeEventListener('input', onSearch))
		}
		setLabel()
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
		if (employeeInput) employeeInput.value = ''
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

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

	return () => {
		disposers.forEach((d) => d())
		delete root.__employeeBound
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

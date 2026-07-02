import { mountDatepicker } from '@/utils/datepicker'

// Mounts the "create visit" modal: custom validation, autosizing comment,
// custom selects and a datepicker. Opens on ANY [data-visit-create] click in the
// document, so the same modal serves the visits panel and the calendar.
export function mountVisitModal(modal) {
	if (!modal || modal.__visitModalBound) return () => {}
	const form = modal.querySelector('[data-visit-form]')
	if (!form) return () => {}
	modal.__visitModalBound = true

	const disposers = []
	const closeEls = [...modal.querySelectorAll('[data-visit-close]')]
	const requiredCtrls = [...form.querySelectorAll('[data-required]')]

	const clearErrors = () => form.querySelectorAll('.is--error').forEach((f) => f.classList.remove('is--error'))
	const validateCtrl = (ctrl) => {
		const ok = (ctrl.value || '').trim().length > 0
		ctrl.closest('.field')?.classList.toggle('is--error', !ok)
		return ok
	}
	const validate = () => requiredCtrls.map(validateCtrl).every(Boolean)

	const onKey = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault()
			closeModal()
		}
	}
	const setOpen = (state) => {
		modal.hidden = !state
		document.documentElement.style.overflow = state ? 'hidden' : ''
		if (state) {
			modal.querySelector('select, input')?.focus({ preventScroll: true })
			document.addEventListener('keydown', onKey, true)
		} else {
			document.removeEventListener('keydown', onKey, true)
		}
	}

	const autosizeEls = [...form.querySelectorAll('[data-autosize]')]
	autosizeEls.forEach((el) => (el.__lastValue = el.value))
	const runAutosize = () => autosizeEls.forEach((el) => autosize(el))

	const resetForm = () => {
		form.reset()
		form.querySelectorAll('[data-select]').forEach(resetSelect)
		autosizeEls.forEach((el) => (el.__lastValue = ''))
		clearErrors()
		runAutosize()
	}
	const closeModal = () => {
		resetForm()
		setOpen(false)
	}
	// Prefill the form when opened from an "Изменить" trigger that carries a
	// data-visit-prefill JSON payload (employee/date/time/manager/type/comment).
	const applyPrefill = (data) => {
		if (!data) return
		const dateEl = form.querySelector('[name="date"]')
		if (dateEl && data.date != null) dateEl.value = data.date
		const commentEl = form.querySelector('[name="comment"]')
		if (commentEl && data.comment != null) {
			commentEl.value = data.comment
			commentEl.__lastValue = data.comment
		}
		form.querySelectorAll('[data-select]').forEach((select) => {
			const input = select.querySelector('[data-select-input]')
			const val = input && data[input.name]
			if (val != null && val !== '') setSelectValue(select, val)
		})
	}
	const openModal = (prefill) => {
		resetForm()
		applyPrefill(prefill)
		clearErrors()
		setOpen(true)
		runAutosize()
	}

	const onAutosize = (e) => {
		const ta = e.target
		if (!ta.matches('[data-autosize]')) return
		if (exceedsAutosize(ta)) {
			const pos = ta.selectionStart
			ta.value = ta.__lastValue ?? ''
			const caret = Math.max(0, Math.min(pos - 1, ta.value.length))
			try {
				ta.setSelectionRange(caret, caret)
			} catch {}
		} else {
			ta.__lastValue = ta.value
		}
		autosize(ta)
	}
	const onSubmit = (e) => {
		e.preventDefault()
		if (!validate()) return
		closeModal() // no backend — just reset & close on success
	}
	const onClose = (e) => {
		e.preventDefault()
		closeModal()
	}
	const onInput = (e) => {
		const ctrl = e.target.closest('[data-required]')
		if (ctrl) validateCtrl(ctrl)
	}
	// open from any "Создать визит" / "Изменить" trigger anywhere on the page
	const onDocCreate = (e) => {
		const trigger = e.target.closest('[data-visit-create]')
		if (!trigger) return
		e.preventDefault()
		let prefill = null
		if (trigger.dataset.visitPrefill) {
			try {
				prefill = JSON.parse(trigger.dataset.visitPrefill)
			} catch {}
		}
		openModal(prefill)
	}

	setOpen(false)
	document.addEventListener('click', onDocCreate)
	form.addEventListener('submit', onSubmit)
	form.addEventListener('input', onInput)
	form.addEventListener('change', onInput)
	form.addEventListener('input', onAutosize)
	closeEls.forEach((el) => el.addEventListener('click', onClose))
	disposers.push(() => {
		document.removeEventListener('click', onDocCreate)
		form.removeEventListener('submit', onSubmit)
		form.removeEventListener('input', onInput)
		form.removeEventListener('change', onInput)
		form.removeEventListener('input', onAutosize)
		closeEls.forEach((el) => el.removeEventListener('click', onClose))
		document.removeEventListener('keydown', onKey, true)
		document.documentElement.style.overflow = ''
	})

	form.querySelectorAll('[data-datepicker]').forEach((el) => {
		const dispose = mountDatepicker(el)
		if (dispose) disposers.push(dispose)
	})
	form.querySelectorAll('[data-select]').forEach((el) => {
		const dispose = initSelect(el)
		if (dispose) disposers.push(dispose)
	})

	return () => {
		disposers.forEach((dispose) => dispose())
		delete modal.__visitModalBound
	}
}

// Reusable custom dropdown over a hidden input (so it validates like a field).
function initSelect(select) {
	const trigger = select.querySelector('[data-select-trigger]')
	const panel = select.querySelector('[data-select-panel]')
	const valueEl = select.querySelector('[data-select-value]')
	const input = select.querySelector('[data-select-input]')
	const options = [...select.querySelectorAll('.ui-select__option')]
	if (!trigger || !panel) return null

	const searchInput = select.querySelector('[data-select-search-input]')
	const emptyEl = select.querySelector('[data-select-empty]')
	const applyFilter = (q) => {
		const norm = q.trim().toLowerCase()
		let visible = 0
		options.forEach((o) => {
			const match = o.textContent.toLowerCase().includes(norm)
			o.hidden = !match
			if (match) visible++
		})
		if (emptyEl) emptyEl.hidden = visible > 0
	}

	let open = false
	const setOpen = (state) => {
		open = state
		select.classList.toggle('is-open', state)
		trigger.setAttribute('aria-expanded', state ? 'true' : 'false')
		if (state && searchInput) {
			searchInput.value = ''
			applyFilter('')
			searchInput.focus({ preventScroll: true })
		}
	}

	const onTrigger = (e) => {
		e.preventDefault()
		e.stopPropagation()
		setOpen(!open)
	}
	const onOption = (e) => {
		const option = e.target.closest('.ui-select__option')
		if (!option) return
		options.forEach((o) => o.classList.toggle('is-active', o === option))
		const value = option.dataset.value ?? option.textContent.trim()
		if (valueEl) valueEl.textContent = option.textContent.trim()
		select.classList.add('is-filled')
		if (input) {
			input.value = value
			input.dispatchEvent(new Event('change', { bubbles: true }))
		}
		setOpen(false)
	}
	const onDocDown = (e) => {
		if (open && !select.contains(e.target)) setOpen(false)
	}
	const onSearch = (e) => applyFilter(e.target.value)
	const onSearchKey = (e) => {
		if (e.key === 'Escape') {
			e.stopPropagation()
			setOpen(false)
			trigger.focus({ preventScroll: true })
		} else if (e.key === 'Enter') {
			e.preventDefault()
			const first = options.find((o) => !o.hidden)
			if (first) first.click()
		}
	}

	setOpen(false)
	trigger.addEventListener('click', onTrigger)
	panel.addEventListener('click', onOption)
	document.addEventListener('pointerdown', onDocDown, true)
	if (searchInput) {
		searchInput.addEventListener('input', onSearch)
		searchInput.addEventListener('keydown', onSearchKey)
	}

	return () => {
		trigger.removeEventListener('click', onTrigger)
		panel.removeEventListener('click', onOption)
		document.removeEventListener('pointerdown', onDocDown, true)
		if (searchInput) {
			searchInput.removeEventListener('input', onSearch)
			searchInput.removeEventListener('keydown', onSearchKey)
		}
		select.classList.remove('is-open')
	}
}

// Programmatically select a value (used by prefill). Falls back to showing the
// raw value when it isn't among the options, so an employee/manager that isn't
// in the demo list still displays instead of staying empty.
function setSelectValue(select, value) {
	const valueEl = select.querySelector('[data-select-value]')
	const input = select.querySelector('[data-select-input]')
	const options = [...select.querySelectorAll('.ui-select__option')]
	const match = options.find((o) => (o.dataset.value ?? o.textContent.trim()) === String(value))
	options.forEach((o) => o.classList.toggle('is-active', o === match))
	if (valueEl) valueEl.textContent = match ? match.textContent.trim() : String(value)
	select.classList.add('is-filled')
	if (input) input.value = match ? match.dataset.value ?? match.textContent.trim() : String(value)
}

function resetSelect(select) {
	const valueEl = select.querySelector('[data-select-value]')
	const input = select.querySelector('[data-select-input]')
	select.classList.remove('is-filled', 'is-open')
	select.querySelectorAll('.ui-select__option.is-active').forEach((o) => o.classList.remove('is-active'))
	if (valueEl) valueEl.textContent = valueEl.dataset.placeholder || ''
	if (input) input.value = ''
	const searchInput = select.querySelector('[data-select-search-input]')
	if (searchInput) searchInput.value = ''
	select.querySelectorAll('.ui-select__option[hidden]').forEach((o) => (o.hidden = false))
	const emptyEl = select.querySelector('[data-select-empty]')
	if (emptyEl) emptyEl.hidden = true
}

function measureAutosize(ta) {
	const cs = getComputedStyle(ta)
	const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
	const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
	const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
	const minRows = parseInt(ta.dataset.autosizeMin || '2', 10)
	const maxRows = parseInt(ta.dataset.autosizeMax || '12', 10)
	ta.style.height = 'auto'
	return {
		content: ta.scrollHeight + borderY,
		minH: lh * minRows + padY + borderY,
		maxH: lh * maxRows + padY + borderY,
	}
}
function autosize(ta) {
	const { content, minH, maxH } = measureAutosize(ta)
	ta.style.height = Math.max(minH, Math.min(content, maxH)) + 'px'
}
function exceedsAutosize(ta) {
	const { content, maxH } = measureAutosize(ta)
	return content > maxH + 1
}

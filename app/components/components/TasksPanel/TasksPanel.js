import { mountDatepicker } from '@/utils/datepicker'

export default (root) => {
	if (!root || root.__tasksPanelBound) return
	root.__tasksPanelBound = true

	const disposers = []

	// --- Create-task form: hidden until "Создать", closed on cancel/save ---
	const form = root.querySelector('[data-task-form]')
	const createBtn = root.querySelector('[data-task-create]')
	const cancelBtn = root.querySelector('[data-task-cancel]')
	if (form) {
		const setOpen = (open) => {
			form.hidden = !open
			createBtn?.setAttribute('aria-expanded', open ? 'true' : 'false')
			if (open) form.querySelector('input, textarea')?.focus({ preventScroll: true })
		}
		const onCreate = (e) => {
			e.preventDefault()
			setOpen(form.hidden)
		}
		const onCancel = (e) => {
			e.preventDefault()
			form.reset()
			setOpen(false)
		}
		const onSubmit = (e) => {
			e.preventDefault()
			form.reset()
			setOpen(false)
		}
		setOpen(false)
		createBtn?.addEventListener('click', onCreate)
		cancelBtn?.addEventListener('click', onCancel)
		form.addEventListener('submit', onSubmit)
		disposers.push(() => {
			createBtn?.removeEventListener('click', onCreate)
			cancelBtn?.removeEventListener('click', onCancel)
			form.removeEventListener('submit', onSubmit)
		})
	}

	// --- Datepicker on the "Срок исполнения" field ---
	root.querySelectorAll('[data-datepicker]').forEach((el) => {
		const dispose = mountDatepicker(el)
		if (dispose) disposers.push(dispose)
	})

	// --- Show / hide completed tasks ---
	const toggle = root.querySelector('[data-tasks-toggle]')
	const toggleText = root.querySelector('[data-tasks-toggle-text]')
	const completed = [...root.querySelectorAll('.task-row.is-completed')]
	if (toggle) {
		let shown = false
		const completedCount = completed.length
		const labelHidden = toggleText?.textContent || `Показать завершенные: ${completedCount}`
		const labelShown = 'Скрыть завершенные'

		const render = () => {
			completed.forEach((row) => row.classList.toggle('is-hidden', !shown))
			toggle.setAttribute('aria-expanded', shown ? 'true' : 'false')
			if (toggleText) toggleText.textContent = shown ? labelShown : labelHidden
		}
		const onToggle = () => {
			shown = !shown
			render()
		}
		render()
		toggle.addEventListener('click', onToggle)
		disposers.push(() => {
			toggle.removeEventListener('click', onToggle)
			completed.forEach((row) => row.classList.remove('is-hidden'))
		})
	}

	// --- Task actions dropdown ("...") ---
	root.querySelectorAll('[data-actions]').forEach((menu) => {
		const trigger = menu.querySelector('[data-actions-trigger]')
		const panel = menu.querySelector('[data-actions-panel]')
		if (!trigger || !panel) return

		let open = false
		const setOpen = (state) => {
			open = state
			menu.classList.toggle('is-open', open)
			trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
			panel.setAttribute('aria-hidden', open ? 'false' : 'true')
		}

		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			setOpen(!open)
		}
		const onDocDown = (e) => {
			if (open && !menu.contains(e.target)) setOpen(false)
		}
		const onKey = (e) => {
			if (open && e.key === 'Escape') {
				e.preventDefault()
				setOpen(false)
				trigger.focus({ preventScroll: true })
			}
		}
		const onItemClick = (e) => {
			if (e.target.closest('.actions-menu__item')) setOpen(false)
		}

		setOpen(false)
		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onItemClick)
		document.addEventListener('pointerdown', onDocDown, true)
		document.addEventListener('keydown', onKey, true)
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onItemClick)
			document.removeEventListener('pointerdown', onDocDown, true)
			document.removeEventListener('keydown', onKey, true)
			menu.classList.remove('is-open')
		})
	})

	return () => {
		disposers.forEach((dispose) => dispose())
		delete root.__tasksPanelBound
	}
}

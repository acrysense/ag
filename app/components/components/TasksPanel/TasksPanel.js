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

	// --- Complete / re-open tasks + the show-completed toggle ---
	const list = root.querySelector('.tasks-list')
	const toggle = root.querySelector('[data-tasks-toggle]')
	const toggleText = root.querySelector('[data-tasks-toggle-text]')
	const ALWAYS_VISIBLE = 3
	let shown = false

	// Keep the 3 most recent completed tasks (they sit at the bottom) visible;
	// collapse the older ones under the toggle. Re-runnable after each change.
	const refreshCompleted = () => {
		const completed = [...root.querySelectorAll('.task-row.is-completed')]
		const hideable = completed.slice(0, Math.max(0, completed.length - ALWAYS_VISIBLE))
		completed.forEach((row) => row.classList.remove('is-hidden'))
		if (!toggle) return
		if (hideable.length) {
			toggle.hidden = false
			hideable.forEach((row) => row.classList.toggle('is-hidden', !shown))
			toggle.setAttribute('aria-expanded', shown ? 'true' : 'false')
			if (toggleText) {
				toggleText.textContent = shown ? 'Скрыть завершенные' : `Показать завершенные: ${hideable.length}`
			}
		} else {
			toggle.hidden = true
			shown = false
		}
	}

	if (toggle) {
		const onToggle = () => {
			shown = !shown
			refreshCompleted()
		}
		toggle.addEventListener('click', onToggle)
		disposers.push(() => {
			toggle.removeEventListener('click', onToggle)
			root.querySelectorAll('.task-row.is-completed.is-hidden').forEach((r) => r.classList.remove('is-hidden'))
		})
	}

	// Click the status circle: an active task → completed (muted, moved to the
	// bottom); clicking a completed check re-opens the task back into the active
	// group. Delegated so dynamically completed rows keep working.
	if (list) {
		const CHECK = '<svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-check"></use></svg>'
		const onStatusClick = (e) => {
			const status = e.target.closest('.task-row__status')
			if (!status || !list.contains(status)) return
			const row = status.closest('.task-row')
			if (!row) return
			if (row.classList.contains('is-completed')) {
				row.classList.remove('is-completed', 'is-muted')
				status.classList.remove('task-row__status--soft', 'task-row__status--done')
				status.innerHTML = ''
				const firstCompleted = list.querySelector('.task-row.is-completed')
				if (firstCompleted) list.insertBefore(row, firstCompleted)
				else list.appendChild(row)
			} else {
				row.classList.add('is-completed', 'is-muted')
				status.classList.remove('task-row__status--done')
				status.classList.add('task-row__status--soft')
				status.innerHTML = CHECK
				list.appendChild(row)
			}
			refreshCompleted()
		}
		list.addEventListener('click', onStatusClick)
		disposers.push(() => list.removeEventListener('click', onStatusClick))
	}

	refreshCompleted()

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

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

	// --- "Ответственный" custom select ---
	root.querySelectorAll('[data-task-assignee]').forEach((select) => {
		const trigger = select.querySelector('[data-select-trigger]')
		const panel = select.querySelector('[data-select-panel]')
		const valueEl = select.querySelector('[data-select-value]')
		const inputEl = select.querySelector('[data-select-input]')
		if (!trigger || !panel) return

		let open = false
		const setOpen = (s) => {
			open = s
			select.classList.toggle('is-open', s)
			trigger.setAttribute('aria-expanded', s ? 'true' : 'false')
		}
		const reset = () => {
			setOpen(false)
			select.classList.remove('is-filled')
			select.querySelectorAll('.ui-select__option.is-active').forEach((o) => o.classList.remove('is-active'))
			if (valueEl) valueEl.textContent = valueEl.dataset.placeholder || ''
			if (inputEl) inputEl.value = ''
		}
		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			setOpen(!open)
		}
		const onOption = (e) => {
			const opt = e.target.closest('.ui-select__option')
			if (!opt) return
			select.querySelectorAll('.ui-select__option').forEach((o) => o.classList.toggle('is-active', o === opt))
			if (valueEl) valueEl.textContent = opt.textContent.trim()
			select.classList.add('is-filled')
			if (inputEl) inputEl.value = opt.dataset.value || opt.textContent.trim()
			setOpen(false)
		}
		const onDocDown = (e) => {
			if (open && !select.contains(e.target)) setOpen(false)
		}

		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onOption)
		document.addEventListener('pointerdown', onDocDown, true)
		form?.addEventListener('reset', reset)
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onOption)
			document.removeEventListener('pointerdown', onDocDown, true)
			form?.removeEventListener('reset', reset)
		})
	})

	// --- "Скрыть от сотрудника" eye toggle (open eye → crossed eye, blue when on) ---
	const hideBtn = root.querySelector('[data-task-hide]')
	if (hideBtn) {
		const hideInput = root.querySelector('[data-task-hide-input]')
		const hideUse = hideBtn.querySelector('use')
		const setHidden = (on) => {
			hideBtn.classList.toggle('is-active', on)
			hideBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
			hideUse?.setAttribute('href', on ? '#icon-eye-slash' : '#icon-eye')
			if (hideInput) hideInput.value = on ? '1' : '0'
		}
		const onHide = (e) => {
			e.preventDefault()
			setHidden(hideBtn.getAttribute('aria-pressed') !== 'true')
		}
		const onReset = () => setHidden(false)
		hideBtn.addEventListener('click', onHide)
		form?.addEventListener('reset', onReset)
		disposers.push(() => {
			hideBtn.removeEventListener('click', onHide)
			form?.removeEventListener('reset', onReset)
		})
	}

	// --- Complete / re-open tasks + the show-completed toggle ---
	const list = root.querySelector('.tasks-list')
	const toggle = root.querySelector('[data-tasks-toggle]')
	const toggleText = root.querySelector('[data-tasks-toggle-text]')
	const ALWAYS_VISIBLE = 3
	let shown = false

	// A completed task still awaiting the manager's confirmation has the
	// "Подтвердить выполнение" button. Those stay full-colour and lead the
	// completed group; fully-closed tasks are muted (lightened).
	const isPending = (row) => !!row.querySelector('.task-row__confirm')

	// Group completed tasks at the bottom (pending first), and set the muted /
	// status look from whether each task is still pending confirmation.
	const classifyCompleted = () => {
		if (!list) return
		const completed = [...list.querySelectorAll('.task-row.is-completed')]
		completed.forEach((row) => {
			const pending = isPending(row)
			row.classList.toggle('is-muted', !pending)
			const status = row.querySelector('.task-row__status')
			if (status) {
				status.classList.toggle('task-row__status--soft', !pending)
				status.classList.toggle('task-row__status--done', pending)
			}
		})
		const ordered = [...completed.filter(isPending), ...completed.filter((r) => !isPending(r))]
		ordered.forEach((row) => list.appendChild(row))
	}

	// Keep pending tasks + the 3 most recent closed ones visible; collapse older
	// closed tasks under the toggle. Re-runnable after each change.
	const refreshCompleted = () => {
		const closed = [...root.querySelectorAll('.task-row.is-completed')].filter((r) => !isPending(r))
		const hideable = closed.slice(0, Math.max(0, closed.length - ALWAYS_VISIBLE))
		root.querySelectorAll('.task-row.is-completed').forEach((row) => row.classList.remove('is-hidden'))
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

	const updateCompleted = () => {
		classifyCompleted()
		refreshCompleted()
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

	// Click the status circle: an active task → completed (classified below);
	// clicking a completed check re-opens it into the active group. Delegated so
	// dynamically completed rows keep working.
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
				row.classList.add('is-completed')
				status.innerHTML = CHECK
			}
			updateCompleted()
		}
		list.addEventListener('click', onStatusClick)
		disposers.push(() => list.removeEventListener('click', onStatusClick))
	}

	updateCompleted()

	// Give every task row the actions ("…") menu so it reveals on row hover.
	const ACTIONS_HTML = `<div class="actions-menu" data-actions>
		<button type="button" class="actions-menu__trigger" data-actions-trigger aria-haspopup="menu" aria-expanded="false" aria-label="Действия">
			<svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-three-dots"></use></svg>
		</button>
		<div class="actions-menu__panel" data-actions-panel role="menu" aria-hidden="true">
			<button type="button" class="actions-menu__item" role="menuitem"><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-comments"></use></svg><span>Комментировать</span></button>
			<button type="button" class="actions-menu__item" role="menuitem"><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-edit-square"></use></svg><span>Редактировать</span></button>
			<button type="button" class="actions-menu__item" role="menuitem"><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-trash"></use></svg><span>Удалить</span></button>
		</div>
	</div>`
	// Trailing tools (eye + "…") live in their own .task-row__tools wrapper so
	// they can be aligned independently of the assignee/date meta block.
	root.querySelectorAll('.task-row').forEach((row) => {
		let tools = row.querySelector('.task-row__tools')
		if (!tools) {
			tools = document.createElement('div')
			tools.className = 'task-row__tools'
			row.appendChild(tools)
		}
		const eye = row.querySelector('.task-row__hidden')
		if (eye && eye.parentElement !== tools) tools.appendChild(eye)
		// move an existing menu (some rows have one in markup) into tools, or
		// inject a fresh one — never leave a duplicate behind in __meta
		const menu = row.querySelector('.actions-menu')
		if (menu && menu.parentElement !== tools) tools.appendChild(menu)
		else if (!menu) tools.insertAdjacentHTML('beforeend', ACTIONS_HTML)
	})

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

	// --- Mobile: physically rebuild each row into a clean flex header so the
	// status + tools centre against the title+meta block reliably (CSS grid +
	// display:contents was too fiddly). Desktop keeps the original DOM. ---
	if (list) {
		const mq = window.matchMedia('(max-width: 743.98px)')

		const toMobile = (row) => {
			if (row.dataset.layout === 'mobile') return
			const status = row.querySelector('.task-row__status')
			const title = row.querySelector('.task-row__title')
			if (!status || !title) return
			const body = row.querySelector('.task-row__body')
			const desc = row.querySelector('.task-row__desc')
			const subline = row.querySelector('.task-row__subline')
			const meta = row.querySelector('.task-row__meta')
			const tools = row.querySelector('.task-row__tools')

			const headtext = document.createElement('div')
			headtext.className = 'task-row__headtext'
			headtext.append(...[title, meta].filter(Boolean))

			const lead = document.createElement('div')
			lead.className = 'task-row__lead'
			lead.append(...[status, headtext, tools].filter(Boolean))

			row.append(...[lead, desc, subline].filter(Boolean))
			if (body) body.remove()
			row.dataset.layout = 'mobile'
		}

		const toDesktop = (row) => {
			if (row.dataset.layout !== 'mobile') return
			const lead = row.querySelector('.task-row__lead')
			const status = row.querySelector('.task-row__status')
			const title = row.querySelector('.task-row__title')
			const desc = row.querySelector('.task-row__desc')
			const subline = row.querySelector('.task-row__subline')
			const meta = row.querySelector('.task-row__meta')
			const tools = row.querySelector('.task-row__tools')

			const body = document.createElement('div')
			body.className = 'task-row__body'
			body.append(...[title, desc, subline].filter(Boolean))

			row.append(...[status, body, meta, tools].filter(Boolean))
			if (lead) lead.remove()
			delete row.dataset.layout
		}

		const sync = () => {
			list.querySelectorAll('.task-row').forEach((row) => {
				if (mq.matches) toMobile(row)
				else toDesktop(row)
			})
		}
		sync()
		const onMq = () => sync()
		mq.addEventListener('change', onMq)
		disposers.push(() => {
			mq.removeEventListener('change', onMq)
			list.querySelectorAll('.task-row').forEach(toDesktop)
		})
	}

	return () => {
		disposers.forEach((dispose) => dispose())
		delete root.__tasksPanelBound
	}
}

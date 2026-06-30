import { mountDatepicker } from '@/utils/datepicker'

// ---- JSON-driven task list -------------------------------------------------
const escTask = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// One <li class="task-row"> from a task object — matches the static markup so all
// the panel wiring (status toggle, completed grouping, actions menu, edit) works.
function taskRowHTML(t) {
	const done = !!t.done
	const awaiting = done && !!t.awaitingConfirm // completed, not yet confirmed → keeps full colour + button
	const check = '<svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-check"></use></svg>'
	const statusCls = done ? (awaiting ? ' task-row__status--done' : ' task-row__status--soft') : ''
	const status = `<span class="task-row__status${statusCls}" aria-hidden="true">${done ? check : ''}</span>`

	let body = `<p class="task-row__title">${escTask(t.title)}</p>`
	if (t.desc) body += `<p class="task-row__desc">${escTask(t.desc)}</p>`
	if (done) {
		const doneCls = awaiting ? 'task-row__done task-row__done--chip' : 'task-row__done'
		let sub = `<span class="${doneCls}"><b>${escTask(t.completedBy)}</b> Выполнена: ${escTask(t.completedDate)}</span>`
		if (awaiting) sub += '<button type="button" class="task-row__confirm">Подтвердить выполнение</button>'
		if (t.verifiedBy)
			sub += `<span class="task-row__verified"><svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-check"></use></svg><b>${escTask(t.verifiedBy)}</b> Проверена: ${escTask(t.verifiedDate)}</span>`
		body += `<p class="task-row__subline">${sub}</p>`
	}

	let meta = `<span class="task-row__assignee">${escTask(t.assignee)}</span><span class="task-row__date">${escTask(t.due)}</span>`
	if (t.hidden)
		meta += '<span class="task-row__hidden" title="Скрыта для сотрудника"><svg aria-hidden="true" focusable="false" width="24" height="24"><use href="#icon-eye-hidden"></use></svg></span>'

	return `<li class="task-row${done ? ' is-completed' : ''}">${status}<div class="task-row__body">${body}</div><div class="task-row__meta">${meta}</div></li>`
}

function buildTaskListHTML(tasks) {
	if (!tasks.length) return '<ul class="tasks-list"><li class="tasks-list__empty">Нет доступных задач</li></ul>'
	return `<ul class="tasks-list">${tasks.map(taskRowHTML).join('')}</ul>`
}

// If the section declares data-tasks-src / inline data-tasks-data, fetch the JSON
// and build the list in place (with a loader) before the panel wiring runs.
async function resolveTasks(root) {
	const src = root.dataset.tasksSrc
	const inlineEl = root.querySelector('[data-tasks-data]')
	if (!src && !inlineEl) return // static-markup mode — nothing to build

	const anchor = root.querySelector('[data-tasks-toggle]')
	const place = (node) => (anchor ? anchor.before(node) : root.appendChild(node))
	root.querySelector('.tasks-list')?.remove() // drop any placeholder list

	const loader = document.createElement('div')
	loader.className = 'tasks-panel__loader'
	loader.innerHTML = '<span class="tasks-panel__spinner" aria-hidden="true"></span><span>Загрузка задач…</span>'
	place(loader)

	let data = null
	try {
		data = src ? await (await fetch(src, { headers: { Accept: 'application/json' } })).json() : JSON.parse(inlineEl.textContent)
	} catch (err) {
		console.warn('[TasksPanel] failed to load tasks', err)
	}
	loader.remove()

	const tasks = Array.isArray(data) ? data : data && Array.isArray(data.tasks) ? data.tasks : null
	if (!tasks) {
		const err = document.createElement('div')
		err.className = 'tasks-panel__loader tasks-panel__loader--error'
		err.textContent = 'Не удалось загрузить задачи'
		place(err)
		return
	}
	const wrap = document.createElement('div')
	wrap.innerHTML = buildTaskListHTML(tasks)
	place(wrap.firstElementChild)
}

export default async (root) => {
	if (!root || root.__tasksPanelBound) return
	root.__tasksPanelBound = true

	// JSON-driven mode: build the list before any wiring touches .task-row nodes
	await resolveTasks(root)

	const disposers = []

	// --- Create / edit task form ---
	// One form serves both: "Создать" opens it at the top; "Редактировать" prefills
	// it and relocates it (in a temporary <li>) in place of the task being edited.
	const form = root.querySelector('[data-task-form]')
	const createBtn = root.querySelector('[data-task-create]')
	const cancelBtn = root.querySelector('[data-task-cancel]')
	if (form) {
		const titleInput = form.querySelector('[name="title"]')
		const dueInput = form.querySelector('[name="due"]')
		const assigneeSelect = form.querySelector('[data-task-assignee]')
		// marker for the form's home position, so edit can move it back
		const formHome = document.createComment('task-form-home')
		form.before(formHome)
		let editRow = null // task <li> being edited (null → create mode)
		let editLi = null // temp <li> hosting the form in place of the task

		const setOpen = (open) => {
			form.hidden = !open
			createBtn?.setAttribute('aria-expanded', open ? 'true' : 'false')
			if (open) form.querySelector('input, textarea')?.focus({ preventScroll: true })
		}
		// prefill the custom widgets directly (their own reset listeners cleared them)
		const setSelect = (select, value) => {
			if (!select) return
			const input = select.querySelector('[data-select-input]')
			const valueEl = select.querySelector('[data-select-value]')
			const opts = [...select.querySelectorAll('.ui-select__option')]
			const match = opts.find((o) => (o.dataset.value || o.textContent.trim()) === value)
			opts.forEach((o) => o.classList.toggle('is-active', o === match))
			select.classList.toggle('is-filled', !!value)
			if (valueEl) valueEl.textContent = value || valueEl.dataset.placeholder || ''
			if (input) input.value = value || ''
		}
		const setHide = (on) => {
			const btn = form.querySelector('[data-task-hide]')
			const inp = form.querySelector('[data-task-hide-input]')
			btn?.classList.toggle('is-active', on)
			btn?.setAttribute('aria-pressed', on ? 'true' : 'false')
			btn?.querySelector('use')?.setAttribute('href', on ? '#icon-eye-slash' : '#icon-eye')
			if (inp) inp.value = on ? '1' : '0'
		}
		const restoreHome = () => {
			formHome.after(form)
			if (editLi) { editLi.remove(); editLi = null }
			if (editRow) { editRow.hidden = false; editRow = null }
		}
		const closeForm = () => {
			form.reset()
			restoreHome()
			setOpen(false)
		}
		const openCreate = () => {
			closeForm()
			setOpen(true)
		}
		const openEdit = (row) => {
			closeForm() // leave any previous create/edit cleanly
			if (titleInput) titleInput.value = row.querySelector('.task-row__title')?.textContent.trim() || ''
			if (dueInput) dueInput.value = row.querySelector('.task-row__date')?.textContent.trim() || ''
			setSelect(assigneeSelect, row.querySelector('.task-row__assignee')?.textContent.trim() || '')
			setHide(!!row.querySelector('.task-row__hidden'))
			editLi = document.createElement('li')
			editLi.className = 'tasks-list__edit'
			row.parentElement.insertBefore(editLi, row)
			editLi.appendChild(form)
			row.hidden = true
			editRow = row
			setOpen(true)
		}
		const saveEdit = (row) => {
			const title = titleInput?.value.trim()
			const assignee = assigneeSelect?.querySelector('[data-select-input]')?.value.trim()
			const due = dueInput?.value.trim()
			const t = row.querySelector('.task-row__title')
			const a = row.querySelector('.task-row__assignee')
			const d = row.querySelector('.task-row__date')
			if (t && title) t.textContent = title
			if (a && assignee) a.textContent = assignee
			if (d && due) d.textContent = due
			// hidden flag → add/remove the eye marker in the row tools
			const on = form.querySelector('[data-task-hide-input]')?.value === '1'
			let mark = row.querySelector('.task-row__hidden')
			if (on && !mark) {
				const tools = row.querySelector('.task-row__tools') || row
				mark = document.createElement('span')
				mark.className = 'task-row__hidden'
				mark.title = 'Скрыта для сотрудника'
				mark.innerHTML = '<svg aria-hidden="true" focusable="false" width="24" height="24"><use href="#icon-eye-hidden"></use></svg>'
				tools.prepend(mark)
			} else if (!on && mark) mark.remove()
		}

		const onCreate = (e) => {
			e.preventDefault()
			// note: form has an <input name="hidden">, so read the attribute, not form.hidden
			const isOpen = !form.hasAttribute('hidden')
			if (!editRow && isOpen) closeForm() // toggle the create form shut
			else openCreate()
		}
		const onCancel = (e) => {
			e.preventDefault()
			closeForm()
		}
		const onSubmit = (e) => {
			e.preventDefault()
			if (editRow) saveEdit(editRow)
			closeForm() // demo: no backend
		}
		const onEditOpen = (e) => {
			const item = e.target.closest('[data-task-edit]')
			if (!item || !root.contains(item)) return
			const row = item.closest('.task-row')
			if (row) openEdit(row)
		}

		setOpen(false)
		createBtn?.addEventListener('click', onCreate)
		cancelBtn?.addEventListener('click', onCancel)
		form.addEventListener('submit', onSubmit)
		root.addEventListener('click', onEditOpen)
		disposers.push(() => {
			createBtn?.removeEventListener('click', onCreate)
			cancelBtn?.removeEventListener('click', onCancel)
			form.removeEventListener('submit', onSubmit)
			root.removeEventListener('click', onEditOpen)
			restoreHome()
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

		// optional in-dropdown search (same UX as the header filters)
		const searchInput = select.querySelector('[data-select-search-input]')
		const emptyEl = select.querySelector('[data-select-empty]')
		const options = [...select.querySelectorAll('.ui-select__option')]
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
		const setOpen = (s) => {
			open = s
			select.classList.toggle('is-open', s)
			trigger.setAttribute('aria-expanded', s ? 'true' : 'false')
			if (s && searchInput) {
				// reset the filter and drop straight into the search field
				searchInput.value = ''
				applyFilter('')
				searchInput.focus({ preventScroll: true })
			}
		}
		const reset = () => {
			setOpen(false)
			select.classList.remove('is-filled')
			select.querySelectorAll('.ui-select__option.is-active').forEach((o) => o.classList.remove('is-active'))
			if (valueEl) valueEl.textContent = valueEl.dataset.placeholder || ''
			if (inputEl) inputEl.value = ''
			if (searchInput) searchInput.value = ''
			options.forEach((o) => (o.hidden = false))
			if (emptyEl) emptyEl.hidden = true
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

		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onOption)
		document.addEventListener('pointerdown', onDocDown, true)
		form?.addEventListener('reset', reset)
		if (searchInput) {
			searchInput.addEventListener('input', onSearch)
			searchInput.addEventListener('keydown', onSearchKey)
		}
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onOption)
			document.removeEventListener('pointerdown', onDocDown, true)
			form?.removeEventListener('reset', reset)
			if (searchInput) {
				searchInput.removeEventListener('input', onSearch)
				searchInput.removeEventListener('keydown', onSearchKey)
			}
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
			<button type="button" class="actions-menu__item" role="menuitem" data-task-comment><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-comments"></use></svg><span>Комментировать</span></button>
			<button type="button" class="actions-menu__item" role="menuitem" data-task-edit><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-edit-square"></use></svg><span>Редактировать</span></button>
			<button type="button" class="actions-menu__item" role="menuitem" data-task-delete><svg aria-hidden="true" focusable="false" width="20" height="20"><use href="#icon-trash"></use></svg><span>Удалить</span></button>
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
			// drop focus from a menu item before hiding the panel — otherwise
			// aria-hidden lands on a focused descendant (assistive-tech warning)
			if (!state && panel.contains(document.activeElement)) document.activeElement.blur()
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

	// --- Delete-task confirm modal (UI only — open/close, no delete wired) ---
	const delModal = root.querySelector('[data-task-delete-modal]')
	if (delModal) {
		const onDelKey = (e) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				setDelOpen(false)
			}
		}
		const setDelOpen = (state) => {
			delModal.hidden = !state
			document.documentElement.style.overflow = state ? 'hidden' : ''
			if (state) {
				delModal.querySelector('.task-modal__dialog')?.focus({ preventScroll: true })
				document.addEventListener('keydown', onDelKey, true)
			} else {
				document.removeEventListener('keydown', onDelKey, true)
			}
		}
		// open from any "Удалить" item in the per-row action menus (delegated,
		// since the menus are injected dynamically)
		const onDelOpen = (e) => {
			if (e.target.closest('[data-task-delete]')) setDelOpen(true)
		}
		// close on overlay, "Отмена", and (no backend yet) the "Удалить" button
		const onDelClose = (e) => {
			if (e.target.closest('[data-task-delete-close], [data-task-delete-confirm]')) setDelOpen(false)
		}
		root.addEventListener('click', onDelOpen)
		delModal.addEventListener('click', onDelClose)
		disposers.push(() => {
			root.removeEventListener('click', onDelOpen)
			delModal.removeEventListener('click', onDelClose)
			document.removeEventListener('keydown', onDelKey, true)
			document.documentElement.style.overflow = ''
		})
	}

	// --- Inline comment (the "Комментировать" action): edit an input that, on
	// save, becomes the row's __desc (grey description). ---
	const COMMENT_HTML = `<div class="task-comment" data-task-comment-editor>
		<input type="text" class="task-comment__input" data-task-comment-input placeholder="Комментарий" autocomplete="off">
		<div class="task-comment__actions">
			<button type="button" class="task-comment__btn task-comment__btn--save" data-task-comment-save aria-label="Сохранить">
				<svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-check"></use></svg>
			</button>
			<button type="button" class="task-comment__btn task-comment__btn--cancel" data-task-comment-cancel aria-label="Отмена">
				<svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-close-middle"></use></svg>
			</button>
		</div>
	</div>`

	const openComment = (row) => {
		const existingEditor = row.querySelector('[data-task-comment-editor]')
		if (existingEditor) {
			existingEditor.querySelector('[data-task-comment-input]')?.focus()
			return
		}
		const desc = row.querySelector('.task-row__desc')
		const lead = row.querySelector('.task-row__lead') // present only on mobile
		const tmp = document.createElement('div')
		tmp.innerHTML = COMMENT_HTML.trim()
		const editor = tmp.firstElementChild
		const input = editor.querySelector('[data-task-comment-input]')
		input.value = desc ? desc.textContent.trim() : ''

		// place the editor where the __desc sits (or would sit)
		if (desc) {
			desc.hidden = true
			desc.after(editor)
		} else if (lead) {
			row.insertBefore(editor, row.querySelector('.task-row__subline') || null)
		} else {
			row.querySelector('.task-row__title')?.after(editor)
		}
		input.focus()

		const close = (save) => {
			if (save) {
				const val = input.value.trim()
				let d = row.querySelector('.task-row__desc')
				if (val) {
					if (!d) {
						d = document.createElement('p')
						d.className = 'task-row__desc'
						editor.before(d)
					}
					d.textContent = val
					d.hidden = false
				} else if (d) {
					d.hidden = false // empty input → leave the existing desc untouched
				}
			} else {
				const d = row.querySelector('.task-row__desc')
				if (d) d.hidden = false
			}
			editor.remove()
		}
		editor.querySelector('[data-task-comment-save]').addEventListener('click', () => close(true))
		editor.querySelector('[data-task-comment-cancel]').addEventListener('click', () => close(false))
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				close(true)
			} else if (e.key === 'Escape') {
				e.preventDefault()
				close(false)
			}
		})
	}

	const onComment = (e) => {
		const item = e.target.closest('[data-task-comment]')
		if (!item || !root.contains(item)) return
		const row = item.closest('.task-row')
		if (row) openComment(row)
	}
	root.addEventListener('click', onComment)
	disposers.push(() => root.removeEventListener('click', onComment))

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

// Visit checklist interactions: collapsible sections, Да/Нет toggles, the
// per-item actions menu (reuses the tasks-page ".actions-menu" pattern:
// three-dots on row hover → dropdown → comment / edit / delete) and the
// geolocation retry. Demo only — the markup is the source of truth.

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// inline comment editor (same shell as the tasks page), saved into __desc
const COMMENT_HTML = `<div class="task-comment" data-q-comment-editor>
	<input type="text" class="task-comment__input" data-q-comment-input placeholder="Комментарий" autocomplete="off">
	<div class="task-comment__actions">
		<button type="button" class="task-comment__btn task-comment__btn--save" data-q-comment-save aria-label="Сохранить"><svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-check"></use></svg></button>
		<button type="button" class="task-comment__btn task-comment__btn--cancel" data-q-comment-cancel aria-label="Отмена"><svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-close-middle"></use></svg></button>
	</div>
</div>`

// inline edit form — like the tasks edit, trimmed to just title + comment
const EDIT_HTML = (title, comment) => `<form class="visit-q__edit" data-q-edit-form novalidate>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Заголовок</label>
		<input type="text" class="visit-q__edit-input" data-q-edit-title value="${escAttr(title)}" autocomplete="off">
	</div>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Комментарий</label>
		<textarea class="visit-q__edit-area" data-q-edit-comment placeholder="Комментарий">${escHtml(comment)}</textarea>
	</div>
	<div class="visit-q__edit-actions">
		<button type="submit" class="btn btn--sm">Сохранить</button>
		<button type="button" class="btn btn--sm btn--secondary" data-q-edit-cancel>Отмена</button>
	</div>
</form>`

export default function Visit(root) {
	if (root.__visitBound) return
	root.__visitBound = true

	// --- actions dropdown (one open at a time) ---
	const setMenuOpen = (menu, state) => {
		menu.classList.toggle('is-open', state)
		menu.querySelector('[data-actions-trigger]')?.setAttribute('aria-expanded', state ? 'true' : 'false')
		menu.querySelector('[data-actions-panel]')?.setAttribute('aria-hidden', state ? 'false' : 'true')
	}
	const closeAllMenus = () => root.querySelectorAll('[data-actions].is-open').forEach((m) => setMenuOpen(m, false))

	// --- inline comment (the "Комментировать" action) ---
	const openComment = (item) => {
		const body = item.querySelector('.visit-q__body')
		if (!body) return
		const existing = item.querySelector('[data-q-comment-editor]')
		if (existing) return existing.querySelector('[data-q-comment-input]')?.focus()
		const desc = item.querySelector('.visit-q__desc')
		const name = item.querySelector('.visit-q__name')
		const tmp = document.createElement('div')
		tmp.innerHTML = COMMENT_HTML.trim()
		const editor = tmp.firstElementChild
		const input = editor.querySelector('[data-q-comment-input]')
		input.value = desc ? desc.textContent.trim() : ''
		if (desc) {
			desc.hidden = true
			desc.after(editor)
		} else if (name) {
			name.after(editor)
		}
		input.focus()

		const close = (save) => {
			if (!save) {
				const d = item.querySelector('.visit-q__desc')
				if (d) d.hidden = false
				editor.remove()
				return
			}
			const val = input.value.trim()
			let d = item.querySelector('.visit-q__desc')
			if (val) {
				if (!d) {
					d = document.createElement('div')
					d.className = 'visit-q__desc'
					editor.before(d)
				}
				d.textContent = val
				d.hidden = false
			} else if (d) {
				d.hidden = false
			}
			editor.remove()
		}
		editor.querySelector('[data-q-comment-save]').addEventListener('click', () => close(true))
		editor.querySelector('[data-q-comment-cancel]').addEventListener('click', () => close(false))
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

	// --- inline edit (the "Редактировать" action): title + comment ---
	const openEdit = (item) => {
		const body = item.querySelector('.visit-q__body')
		if (!body || item.querySelector('[data-q-edit-form]')) return
		const name = item.querySelector('.visit-q__name')
		const desc = item.querySelector('.visit-q__desc')
		const title = name ? name.textContent.trim() : ''
		const comment = desc ? desc.textContent.trim() : ''
		const tmp = document.createElement('div')
		tmp.innerHTML = EDIT_HTML(title, comment).trim()
		const form = tmp.firstElementChild
		body.hidden = true
		body.after(form)
		form.querySelector('[data-q-edit-title]')?.focus()

		const close = (save) => {
			if (save) {
				const t = form.querySelector('[data-q-edit-title]').value.trim()
				const c = form.querySelector('[data-q-edit-comment]').value.trim()
				if (t && name) name.textContent = t
				let d = item.querySelector('.visit-q__desc')
				if (c) {
					if (!d) {
						d = document.createElement('div')
						d.className = 'visit-q__desc'
						name?.after(d)
					}
					d.textContent = c
					d.hidden = false
				} else if (d) {
					d.remove()
				}
			}
			form.remove()
			body.hidden = false
		}
		form.addEventListener('submit', (e) => {
			e.preventDefault()
			close(true)
		})
		form.querySelector('[data-q-edit-cancel]').addEventListener('click', () => close(false))
		form.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				close(false)
			}
		})
	}

	// --- delete confirm modal ---
	const delModal = root.querySelector('[data-q-delete-modal]')
	let pendingDeleteItem = null
	const setDelOpen = (state) => {
		if (!delModal) return
		delModal.hidden = !state
		document.documentElement.style.overflow = state ? 'hidden' : ''
		if (state) delModal.querySelector('.task-modal__dialog')?.focus({ preventScroll: true })
	}

	const onClick = (e) => {
		// collapse / expand a section
		const collapseBtn = e.target.closest('[data-collapse-toggle]')
		if (collapseBtn) {
			collapseBtn.closest('[data-collapsible]')?.classList.toggle('is-collapsed')
			return
		}

		// Да / Нет toggle (single choice within a pair)
		const yn = e.target.closest('[data-yn]')
		if (yn) {
			yn.closest('.visit-q__toggle')
				?.querySelectorAll('[data-yn]')
				.forEach((b) => b.classList.toggle('is-active', b === yn))
			return
		}

		// delete modal controls
		if (e.target.closest('[data-q-delete-confirm]')) {
			pendingDeleteItem?.remove()
			pendingDeleteItem = null
			setDelOpen(false)
			return
		}
		if (e.target.closest('[data-q-delete-close]')) {
			setDelOpen(false)
			return
		}

		// dropdown item picked → run the action, then close the menu
		const menuItem = e.target.closest('.actions-menu__item')
		if (menuItem) {
			const item = menuItem.closest('.visit-q__item')
			closeAllMenus()
			if (item) {
				if (menuItem.matches('[data-q-comment]')) openComment(item)
				else if (menuItem.matches('[data-q-edit]')) openEdit(item)
				else if (menuItem.matches('[data-q-delete]')) {
					pendingDeleteItem = item
					setDelOpen(true)
				}
			}
			return
		}

		// open / close an actions menu
		const trigger = e.target.closest('[data-actions-trigger]')
		if (trigger) {
			const menu = trigger.closest('[data-actions]')
			const willOpen = !menu.classList.contains('is-open')
			closeAllMenus()
			if (willOpen) setMenuOpen(menu, true)
			return
		}

		// geolocation retry (demo: toggle the blocked-access notice)
		const geo = e.target.closest('[data-geo-btn]')
		if (geo) {
			const err = root.querySelector('[data-geo-error]')
			if (err) err.hidden = !err.hidden
			return
		}
	}

	// close menus on outside click; close the modal/menu on Escape
	const onDocDown = (e) => {
		if (!e.target.closest('[data-actions]')) closeAllMenus()
	}
	const onDocKey = (e) => {
		if (e.key !== 'Escape') return
		if (delModal && !delModal.hidden) {
			e.preventDefault()
			setDelOpen(false)
		}
		closeAllMenus()
	}

	root.addEventListener('click', onClick)
	document.addEventListener('pointerdown', onDocDown, true)
	document.addEventListener('keydown', onDocKey, true)

	return () => {
		root.removeEventListener('click', onClick)
		document.removeEventListener('pointerdown', onDocDown, true)
		document.removeEventListener('keydown', onDocKey, true)
		document.documentElement.style.overflow = ''
		delete root.__visitBound
	}
}

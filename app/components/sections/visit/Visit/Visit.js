// Visit checklist interactions: collapsible sections, Да/Нет toggles, the
// per-item actions menu (reuses the tasks-page ".actions-menu" pattern:
// three-dots on row hover → dropdown → comment / edit / delete) and the
// geolocation retry. Demo only — the markup is the source of truth.

import { MAX_COMMENT_LEN, limitLineBreaks } from '@/utils/comment-limits'

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// inline comment editor (same shell as the tasks page), saved into __desc.
// A growing textarea (not a single-line input) so long comments wrap and stay
// visible instead of scrolling off the side.
const COMMENT_HTML = `<div class="task-comment" data-q-comment-editor>
	<textarea class="task-comment__input" name="q-comment" data-q-comment-input rows="1" data-autosize maxlength="${MAX_COMMENT_LEN}" placeholder="Комментарий" autocomplete="off"></textarea>
	<div class="task-comment__actions">
		<button type="button" class="task-comment__btn task-comment__btn--save" data-q-comment-save aria-label="Сохранить"><svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-check"></use></svg></button>
		<button type="button" class="task-comment__btn task-comment__btn--cancel" data-q-comment-cancel aria-label="Отмена"><svg aria-hidden="true" focusable="false" width="14" height="14"><use href="#icon-close-middle"></use></svg></button>
	</div>
</div>`

// inline edit form — like the tasks edit, trimmed to just title + comment
const EDIT_HTML = (title, comment) => `<form class="visit-q__edit" data-q-edit-form novalidate>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Заголовок</label>
		<input type="text" class="visit-q__edit-input" name="q-edit-title" data-q-edit-title value="${escAttr(title)}" autocomplete="off">
	</div>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Комментарий</label>
		<textarea class="visit-q__edit-area" name="q-edit-comment" data-q-edit-comment rows="1" data-autosize maxlength="${MAX_COMMENT_LEN}" placeholder="Комментарий">${escHtml(comment)}</textarea>
	</div>
	<div class="visit-q__edit-actions">
		<button type="submit" class="btn btn--sm">Сохранить</button>
		<button type="button" class="btn btn--sm btn--secondary" data-q-edit-cancel>Отмена</button>
	</div>
</form>`

// inline edit form for a quantitative row — same shell/styling as the checklist
// edit above (title + comment + Сохранить/Отмена), so both blocks match
const QUANT_EDIT_HTML = (title, comment) => `<form class="visit-q__edit" data-quant-edit-form novalidate>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Заголовок</label>
		<input type="text" class="visit-q__edit-input" name="quant-edit-title" data-quant-edit-title value="${escAttr(title)}" autocomplete="off">
	</div>
	<div class="visit-q__edit-field">
		<label class="visit-q__edit-label">Комментарий</label>
		<textarea class="visit-q__edit-area" name="quant-edit-comment" data-quant-edit-comment rows="1" data-autosize maxlength="${MAX_COMMENT_LEN}" placeholder="Комментарий">${escHtml(comment)}</textarea>
	</div>
	<div class="visit-q__edit-actions">
		<button type="submit" class="btn btn--sm">Сохранить</button>
		<button type="button" class="btn btn--sm btn--secondary" data-quant-edit-cancel>Отмена</button>
	</div>
</form>`

export default function Visit(root) {
	if (root.__visitBound) return
	root.__visitBound = true

	// --- actions dropdown (one open at a time) ---
	// The menus sit inside clipping containers (the section's overflow:hidden used
	// for the collapse animation, and the quant table's horizontal scroll), which
	// would cut off an absolutely-positioned dropdown. Pin the panel with
	// position:fixed so it escapes any clip; flip it above the trigger when there's
	// no room below. Closed menus (and any scroll) reset it.
	const pinPanel = (menu) => {
		const panel = menu.querySelector('[data-actions-panel]')
		const trig = menu.querySelector('[data-actions-trigger]')
		if (!panel || !trig) return
		const r = trig.getBoundingClientRect()
		panel.style.position = 'fixed'
		panel.style.right = `${Math.round(window.innerWidth - r.right)}px`
		panel.style.left = 'auto'
		panel.style.top = 'auto'
		panel.style.bottom = 'auto'
		const ph = panel.offsetHeight // measurable — the panel is already display:flex
		// open below, unless it would overflow the viewport bottom and there's room above
		if (r.bottom + 6 + ph > window.innerHeight && r.top - 6 - ph >= 0) {
			panel.style.bottom = `${Math.round(window.innerHeight - r.top + 6)}px`
		} else {
			panel.style.top = `${Math.round(r.bottom + 6)}px`
		}
	}
	const unpinPanel = (menu) => {
		const panel = menu.querySelector('[data-actions-panel]')
		if (!panel) return
		panel.style.position = ''
		panel.style.top = ''
		panel.style.right = ''
		panel.style.left = ''
		panel.style.bottom = ''
	}
	const setMenuOpen = (menu, state) => {
		menu.classList.toggle('is-open', state)
		menu.querySelector('[data-actions-trigger]')?.setAttribute('aria-expanded', state ? 'true' : 'false')
		menu.querySelector('[data-actions-panel]')?.setAttribute('aria-hidden', state ? 'false' : 'true')
		if (state) pinPanel(menu)
		else unpinPanel(menu)
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
		limitLineBreaks(input)
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
		// Enter inserts a new line (multi-line textarea); save via the check button
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
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
		limitLineBreaks(form.querySelector('[data-q-edit-comment]'))
		body.hidden = true
		item.classList.add('is-editing') // mobile: lets the form span the full row
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
			item.classList.remove('is-editing')
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

	// only one inline editor per quant row: close any open comment/edit form (and
	// restore the criterion + saved comment) before opening another, so a row can't
	// be commented and edited at the same time
	const resetQuantRow = (row) => {
		const cell = row.querySelector('.visit-quant__td--crit')
		if (!cell) return
		cell.querySelector('[data-q-comment-editor]')?.remove()
		cell.querySelector('[data-quant-edit-form]')?.remove()
		const crit = cell.querySelector('.visit-quant__crit')
		if (crit) crit.hidden = false
		const desc = cell.querySelector('.visit-quant__comment')
		if (desc) desc.hidden = false
		row.classList.remove('is-editing')
	}

	// --- inline comment for a quantitative row (shown under the criterion) ---
	const openQuantComment = (row) => {
		const cell = row.querySelector('.visit-quant__td--crit')
		if (!cell) return
		const existing = cell.querySelector('[data-q-comment-editor]')
		if (existing) return existing.querySelector('[data-q-comment-input]')?.focus()
		resetQuantRow(row) // close an open edit form first
		const crit = cell.querySelector('.visit-quant__crit')
		const desc = cell.querySelector('.visit-quant__comment')
		const tmp = document.createElement('div')
		tmp.innerHTML = COMMENT_HTML.trim()
		const editor = tmp.firstElementChild
		const input = editor.querySelector('[data-q-comment-input]')
		limitLineBreaks(input)
		input.value = desc ? desc.textContent.trim() : ''
		if (desc) {
			desc.hidden = true
			desc.after(editor)
		} else if (crit) {
			crit.after(editor)
		}
		input.focus()

		const close = (save) => {
			if (!save) {
				const d = cell.querySelector('.visit-quant__comment')
				if (d) d.hidden = false
				editor.remove()
				return
			}
			const val = input.value.trim()
			let d = cell.querySelector('.visit-quant__comment')
			if (val) {
				if (!d) {
					d = document.createElement('div')
					d.className = 'visit-quant__comment'
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
			if (e.key === 'Escape') {
				e.preventDefault()
				close(false)
			}
		})
	}

	// --- inline edit of a quantitative row (title + comment, like the checklist) ---
	const openQuantEdit = (row) => {
		const cell = row.querySelector('.visit-quant__td--crit')
		if (!cell) return
		const crit = cell.querySelector('.visit-quant__crit')
		if (!crit || cell.querySelector('[data-quant-edit-form]')) return
		resetQuantRow(row) // close an open comment editor first
		const desc = cell.querySelector('.visit-quant__comment')
		const tmp = document.createElement('div')
		tmp.innerHTML = QUANT_EDIT_HTML(crit.textContent.trim(), desc ? desc.textContent.trim() : '').trim()
		const form = tmp.firstElementChild
		limitLineBreaks(form.querySelector('[data-quant-edit-comment]'))
		crit.hidden = true
		if (desc) desc.hidden = true
		row.classList.add('is-editing') // form spans the full row, numeric cells hidden
		cell.appendChild(form)
		form.querySelector('[data-quant-edit-title]')?.focus()

		const close = (save) => {
			if (save) {
				const t = form.querySelector('[data-quant-edit-title]').value.trim()
				const c = form.querySelector('[data-quant-edit-comment]').value.trim()
				if (t) crit.textContent = t
				let d = cell.querySelector('.visit-quant__comment')
				if (c) {
					if (!d) {
						d = document.createElement('div')
						d.className = 'visit-quant__comment'
						crit.after(d)
					}
					d.textContent = c
					d.hidden = false
				} else if (d) {
					d.remove()
				}
			} else if (desc) {
				desc.hidden = false
			}
			form.remove()
			crit.hidden = false
			row.classList.remove('is-editing')
		}
		form.addEventListener('submit', (e) => {
			e.preventDefault()
			close(true)
		})
		form.querySelector('[data-quant-edit-cancel]').addEventListener('click', () => close(false))
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
			closeAllMenus()
			// checklist item actions
			const item = menuItem.closest('.visit-q__item')
			if (item) {
				if (menuItem.matches('[data-q-comment]')) openComment(item)
				else if (menuItem.matches('[data-q-edit]')) openEdit(item)
				else if (menuItem.matches('[data-q-delete]')) {
					pendingDeleteItem = item
					setDelOpen(true)
				}
				return
			}
			// quantitative-table row actions (comment under the criterion; edit
			// changes the criterion title itself)
			const row = menuItem.closest('.visit-quant__row')
			if (row) {
				if (menuItem.matches('[data-quant-comment]')) openQuantComment(row)
				else if (menuItem.matches('[data-quant-edit]')) openQuantEdit(row)
				else if (menuItem.matches('[data-quant-delete]')) {
					pendingDeleteItem = row
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

	// close open menus on any scroll (window or the quant table) so a pinned
	// fixed panel can't drift away from its trigger
	const onScroll = () => {
		if (root.querySelector('[data-actions].is-open')) closeAllMenus()
	}

	root.addEventListener('click', onClick)
	document.addEventListener('pointerdown', onDocDown, true)
	document.addEventListener('keydown', onDocKey, true)
	window.addEventListener('scroll', onScroll, { passive: true, capture: true })

	return () => {
		root.removeEventListener('click', onClick)
		document.removeEventListener('pointerdown', onDocDown, true)
		document.removeEventListener('keydown', onDocKey, true)
		window.removeEventListener('scroll', onScroll, true)
		document.documentElement.style.overflow = ''
		delete root.__visitBound
	}
}

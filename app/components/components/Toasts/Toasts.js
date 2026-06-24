export default (root) => {
	if (!root || root.__bound) return
	root.__bound = true

	const maxStack = 5
	const cleanups = new Set()

	const escapeHtml = (s = '') =>
		s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m])

	// success = green check (sprite); error = red rounded triangle with a "!"
	// punched out (the toast's white background shows through the hole)
	const ICON_SUCCESS = '<svg aria-hidden="true" focusable="false"><use href="#icon-check"></use></svg>'
	const ICON_ERROR =
		'<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" fill="currentColor"/></svg>'
	const ICON_CLOSE =
		'<svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

	const make = ({ type = 'success', title = '', text = '', timeout = 5000, role } = {}) => {
		const el = document.createElement('div')
		el.className = `toast toast--${type}`
		el.setAttribute('role', role || (type === 'error' ? 'alert' : 'status'))
		el.innerHTML = `
			<span class="toast__icon">${type === 'error' ? ICON_ERROR : ICON_SUCCESS}</span>
			<div class="toast__body">
				${title ? `<p class="toast__title">${escapeHtml(title)}</p>` : ''}
				${text ? `<p class="toast__text">${escapeHtml(text)}</p>` : ''}
			</div>
			<button type="button" class="toast__close" aria-label="Закрыть">${ICON_CLOSE}</button>
		`.trim()

		let timer = null
		let removeTimer = null
		let enterFrame = null
		let closed = false
		const remove = () => {
			clearTimeout(removeTimer)
			el.remove()
			cleanups.delete(cleanup)
		}
		const close = () => {
			if (closed) return
			closed = true
			clearTimeout(timer)
			el.classList.remove('is-in')
			el.classList.add('is-out')
			el.addEventListener('transitionend', remove, { once: true })
			removeTimer = setTimeout(remove, 350)
		}
		const cleanup = () => {
			clearTimeout(timer)
			clearTimeout(removeTimer)
			cancelAnimationFrame(enterFrame)
			el.removeEventListener('transitionend', remove)
			el.remove()
		}
		cleanups.add(cleanup)
		el.__toastClose = close

		el.querySelector('.toast__close').addEventListener('click', close)

		el.addEventListener('mouseenter', () => {
			if (timer) {
				clearTimeout(timer)
				timer = null
			}
		})
		el.addEventListener('mouseleave', () => {
			if (!timer && timeout) timer = setTimeout(close, timeout)
		})

		root.appendChild(el)
		enterFrame = requestAnimationFrame(() => el.classList.add('is-in'))

		if (timeout) timer = setTimeout(close, timeout)

		const items = root.querySelectorAll('.toast')
		if (items.length > maxStack) items[0].__toastClose?.()

		return el
	}

	const show = (opts) => make(typeof opts === 'string' ? { text: opts } : opts || {})
	const success = (text, opts = {}) => show({ type: 'success', text, ...opts })
	const error = (text, opts = {}) => show({ type: 'error', text, ...opts })

	const onToastShow = (e) => show(e.detail || {})
	document.addEventListener('toast:show', onToastShow)

	const api = { show, success, error }
	window.toast = api

	// server-rendered toasts (Bitrix): drop a hidden element anywhere on the page,
	// e.g. <div data-toast data-type="error" data-title="Ошибка" data-text="…">
	document.querySelectorAll('[data-toast]').forEach((n) => {
		show({
			type: n.dataset.type || 'success',
			title: n.dataset.title || '',
			text: n.dataset.text || '',
			timeout: parseInt(n.dataset.timeout || '5000', 10),
		})
		n.remove()
	})

	return () => {
		document.removeEventListener('toast:show', onToastShow)
		cleanups.forEach((cleanup) => cleanup())
		cleanups.clear()
		if (window.toast === api) delete window.toast
	}
}

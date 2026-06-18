export default (root) => {
	if (!root || root.__bound) return
	root.__bound = true

	const maxStack = 5
	const cleanups = new Set()

	const escapeHtml = (s = '') =>
		s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m])

	const make = ({ type = 'success', text = '', timeout = 4000, id = null, role } = {}) => {
		const el = document.createElement('div')
		el.className = `toast toast--${type}`
		el.setAttribute('role', role || (type === 'error' ? 'alert' : 'status'))
		el.innerHTML = `
			<span class="toast__text">${escapeHtml(text)}</span>
			<button class="toast__close" aria-label="Закрыть">
				<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16"><use href="#icon-close"></use></svg>
			</button>
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

	document.querySelectorAll('[data-toast][data-text]').forEach((n) => {
		show({
			type: n.dataset.type || 'success',
			text: n.dataset.text,
			timeout: parseInt(n.dataset.timeout || '4000', 10),
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

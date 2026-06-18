export default (root) => {
	if (!root || root.__bound) return
	root.__bound = true

	const btn = root.querySelector('.top-notice__close')
	const key = root.dataset.key || 'global'
	const storeKey = `topNotice:${key}:date`
	const today = (() => {
		const d = new Date()
		const y = d.getFullYear()
		const m = String(d.getMonth() + 1).padStart(2, '0')
		const dd = String(d.getDate()).padStart(2, '0')
		return `${y}-${m}-${dd}`
	})()

	const setH = () => root.style.setProperty('--h', root.scrollHeight + 'px')

	const hide = () => {
		root.classList.add('is-hidden')
		root.setAttribute('aria-hidden', 'true')
		try {
			localStorage.setItem(storeKey, today)
		} catch {}
	}

	const show = () => {
		root.classList.remove('is-hidden')
		root.removeAttribute('aria-hidden')
		setH()
	}

	let v = null
	try {
		v = localStorage.getItem(storeKey)
	} catch {}
	if (v === '1' || v === today) {
		root.classList.add('is-hidden')
		root.setAttribute('aria-hidden', 'true')
	} else {
		show()
	}

	const onCloseClick = (e) => {
		e.preventDefault()
		hide()
	}
	btn?.addEventListener('click', onCloseClick)

	const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => setH())
	ro?.observe(root)
	window.addEventListener('resize', setH, { passive: true })

	return () => {
		btn?.removeEventListener('click', onCloseClick)
		ro?.disconnect()
		window.removeEventListener('resize', setH)
	}
}

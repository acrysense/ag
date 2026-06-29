// Visit checklist interactions: collapsible sections, Да/Нет toggles, the
// per-item actions menu and the geolocation retry (demo). No data layer — the
// markup is the source of truth.

export default function Visit(root) {
	if (root.__visitBound) return
	root.__visitBound = true

	const closeMenus = () => root.querySelectorAll('[data-menu-panel]').forEach((p) => (p.hidden = true))

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

		// menu item picked → just close (actions are stubs for now)
		if (e.target.closest('.visit-menu__item')) {
			closeMenus()
			return
		}

		// open / close an actions menu (one at a time)
		const trigger = e.target.closest('[data-menu-trigger]')
		if (trigger) {
			const panel = trigger.parentElement.querySelector('[data-menu-panel]')
			const willOpen = panel.hidden
			closeMenus()
			panel.hidden = !willOpen
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

	// click anywhere outside an open menu closes it
	const onDocClick = (e) => {
		if (!e.target.closest('[data-menu]')) closeMenus()
	}

	root.addEventListener('click', onClick)
	document.addEventListener('click', onDocClick)

	return () => {
		root.removeEventListener('click', onClick)
		document.removeEventListener('click', onDocClick)
		delete root.__visitBound
	}
}

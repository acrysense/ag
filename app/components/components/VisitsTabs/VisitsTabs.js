// Segmented "Новые / История" tabs for a visits panel: toggles the active button
// and swaps between the [data-visits-panel] lists. Demo-only — the two lists are
// static markup; clicking a tab just shows the matching one.
export default (root) => {
	if (!root || root.__visitsTabsBound) return
	root.__visitsTabsBound = true

	const tabs = [...root.querySelectorAll('[data-visits-tab]')]
	const panels = [...root.querySelectorAll('[data-visits-panel]')]
	if (tabs.length < 2 || panels.length < 2) return

	const activate = (idx) => {
		tabs.forEach((tab, i) => {
			const on = i === idx
			tab.classList.toggle('is-active', on)
			tab.setAttribute('aria-selected', on ? 'true' : 'false')
		})
		panels.forEach((panel, i) => {
			panel.hidden = i !== idx
		})
	}

	const disposers = tabs.map((tab, i) => {
		const onClick = () => activate(i)
		tab.addEventListener('click', onClick)
		return () => tab.removeEventListener('click', onClick)
	})

	// start on whichever tab already carries is-active (fall back to the first)
	activate(Math.max(0, tabs.findIndex((t) => t.classList.contains('is-active'))))

	return () => {
		disposers.forEach((dispose) => dispose())
		delete root.__visitsTabsBound
	}
}

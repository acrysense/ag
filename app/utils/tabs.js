let _uid = 0

export function mountTabs(scope = document) {
	const disposers = []
	const mountedHosts = []
	const hosts = (scope.matches?.('.tabs') ? [scope] : [])
		.concat([...scope.querySelectorAll('.tabs')])
		.filter((el) => !el.__tabs)

	hosts.forEach((host) => {
		const list = host.querySelector('.tabs__list') || host
		const items = [...host.querySelectorAll('.tabs__item')]
		const buttons = items.map((it) => it.querySelector('.tabs__tab')).filter(Boolean)
		const panels = [...host.querySelectorAll('.tabs__wrapper')]
		if (!buttons.length || !panels.length) return

		const uid = (++_uid).toString(36)

		list.setAttribute('role', 'tablist')
		buttons.forEach((btn, i) => {
			btn.type = 'button'
			btn.setAttribute('role', 'tab')
			if (!btn.id) btn.id = `tab-${uid}-${i}`
		})
		panels.forEach((p, i) => {
			p.setAttribute('role', 'tabpanel')
			if (!p.id) p.id = `panel-${uid}-${i}`
			const btn = buttons[i]
			if (btn) {
				btn.setAttribute('aria-controls', p.id)
				p.setAttribute('aria-labelledby', btn.id)
			}
		})

		let active = Math.max(
			0,
			items.findIndex((it) => it.classList.contains('is--active')),
			panels.findIndex((p) => p.classList.contains('is--active'))
		)

		function activate(idx, emit = true) {
			items.forEach((it, i) => {
				const on = i === idx
				it.classList.toggle('is--active', on)
				const b = buttons[i]
				if (b) {
					b.setAttribute('aria-selected', on ? 'true' : 'false')
					b.setAttribute('tabindex', on ? '0' : '-1')
				}
			})
			panels.forEach((p, i) => {
				const on = i === idx
				p.classList.toggle('is--active', on)
				p.setAttribute('aria-hidden', on ? 'false' : 'true')
			})
			active = idx
			if (emit) {
				host.dispatchEvent(
					new CustomEvent('tabs:change', {
						bubbles: true,
						detail: { index: idx, button: buttons[idx], panel: panels[idx] },
					})
				)
			}
		}

		buttons.forEach((btn, i) => {
			const onClick = (e) => {
				e.preventDefault()
				if (i !== active) activate(i, true)
			}
			const onKeydown = (e) => {
				switch (e.key) {
					case 'ArrowRight':
					case 'Right':
						e.preventDefault()
						focusMove(1)
						break
					case 'ArrowLeft':
					case 'Left':
						e.preventDefault()
						focusMove(-1)
						break
					case 'Home':
						e.preventDefault()
						focusIndex(0)
						break
					case 'End':
						e.preventDefault()
						focusIndex(buttons.length - 1)
						break
					case 'Enter':
					case ' ':
						e.preventDefault()
						activate(i, true)
						break
				}
			}
			btn.addEventListener('click', onClick)
			btn.addEventListener('keydown', onKeydown)
			disposers.push(() => {
				btn.removeEventListener('click', onClick)
				btn.removeEventListener('keydown', onKeydown)
			})
		})

		function focusMove(step) {
			let i = (active + step + buttons.length) % buttons.length
			buttons[i].focus({ preventScroll: true })
			activate(i, true)
		}
		function focusIndex(i) {
			if (!buttons[i]) return
			buttons[i].focus({ preventScroll: true })
			activate(i, true)
		}

		activate(active, false)

		host.__tabs = {
			activate,
			index: () => active,
			destroy: () => {
				delete host.__tabs
			},
		}
		mountedHosts.push(host)
	})

	return () => {
		disposers.forEach((dispose) => dispose())
		mountedHosts.forEach((host) => host.__tabs?.destroy?.())
	}
}

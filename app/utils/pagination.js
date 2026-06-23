// Self-contained client pagination for a static `.ui-pagination` nav.
// Infers the total page count + current page from the initial markup, then
// renders a windowed page list — current ±1 on desktop, a compact ≤5-slot
// window on mobile so the row never overflows the screen (same logic the
// visits table uses). Visual only: clicking a page just moves the marker.

const DOTS_SVG =
	'<svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-three-dots"></use></svg>'

export function mountStaticPagination(nav) {
	if (!nav || nav.__paginationBound) return () => {}
	nav.__paginationBound = true

	// derive total (largest page number) and current page from the static items
	const nums = [...nav.querySelectorAll('.ui-pagination__item')]
		.map((b) => parseInt(b.textContent, 10))
		.filter((n) => !Number.isNaN(n))
	const total = nums.length ? Math.max(...nums) : 1
	const activeBtn = nav.querySelector('.ui-pagination__item.is-active')
	let page = (activeBtn && parseInt(activeBtn.textContent, 10)) || 1

	const mqMobile = window.matchMedia('(max-width: 743.98px)')

	// On mobile keep a constant, screen-fitting number of slots; on desktop show
	// the current page with one neighbour on each side.
	const pageItems = () => {
		if (total <= 1) return [1]

		if (mqMobile.matches) {
			const BUDGET = 5 // max items (numbers + ellipses) between the nav buttons
			const pages = new Set([1, total, page])
			const slotCount = () => {
				const s = [...pages].sort((a, b) => a - b)
				let n = s.length
				for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > 1) n++
				return n
			}
			let left = page - 1
			let right = page + 1
			let toLeft = true
			while (left >= 1 || right <= total) {
				const cand = toLeft ? left : right
				if (cand >= 1 && cand <= total && !pages.has(cand)) {
					pages.add(cand)
					if (slotCount() > BUDGET) {
						pages.delete(cand)
						break
					}
				}
				if (toLeft) left--
				else right++
				toLeft = !toLeft
			}
			const sorted = [...pages].sort((a, b) => a - b)
			const out = []
			for (let i = 0; i < sorted.length; i++) {
				if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
				out.push(sorted[i])
			}
			return out
		}

		const out = [1]
		const l = Math.max(2, page - 1)
		const r = Math.min(total - 1, page + 1)
		if (l > 2) out.push('…')
		for (let i = l; i <= r; i++) out.push(i)
		if (r < total - 1) out.push('…')
		out.push(total)
		return out
	}

	const render = () => {
		nav.replaceChildren()
		const prev = document.createElement('button')
		prev.type = 'button'
		prev.className = 'ui-pagination__item ui-pagination__item--prev'
		prev.textContent = 'Назад'
		prev.dataset.prev = '1'
		prev.disabled = page <= 1
		nav.appendChild(prev)
		pageItems().forEach((it) => {
			if (it === '…') {
				const dots = document.createElement('span')
				dots.className = 'ui-pagination__dots'
				dots.innerHTML = DOTS_SVG
				nav.appendChild(dots)
				return
			}
			const btn = document.createElement('button')
			btn.type = 'button'
			btn.className = 'ui-pagination__item'
			btn.textContent = String(it)
			btn.dataset.page = String(it)
			if (it === page) {
				btn.classList.add('is-active')
				btn.setAttribute('aria-current', 'page')
			}
			nav.appendChild(btn)
		})
		const next = document.createElement('button')
		next.type = 'button'
		next.className = 'ui-pagination__item ui-pagination__item--next'
		next.textContent = 'Вперед'
		next.dataset.next = '1'
		next.disabled = page >= total
		nav.appendChild(next)
	}

	const goTo = (p) => {
		page = Math.min(Math.max(1, p), total)
		render()
	}
	const onClick = (e) => {
		const item = e.target.closest('.ui-pagination__item')
		if (!item || item.disabled) return
		if (item.dataset.page) goTo(parseInt(item.dataset.page, 10))
		else if (item.dataset.next) goTo(page + 1)
		else if (item.dataset.prev) goTo(page - 1)
	}
	// re-render the page list when crossing the mobile breakpoint
	const onMqChange = () => render()

	nav.addEventListener('click', onClick)
	mqMobile.addEventListener('change', onMqChange)
	render()

	return () => {
		nav.removeEventListener('click', onClick)
		mqMobile.removeEventListener('change', onMqChange)
		delete nav.__paginationBound
	}
}

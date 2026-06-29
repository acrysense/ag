import { mountTabs } from '@/utils/tabs'

export default (root) => {
	if (!root || root.__visitsPanelBound) return
	root.__visitsPanelBound = true

	const disposers = []

	// --- Segmented tabs (История / Новые) — reuse the project's tabs util ---
	const disposeTabs = mountTabs(root)
	if (disposeTabs) disposers.push(disposeTabs)

	// The footer (pagination + page-size) belongs to the table — hide it on any
	// tab other than "История" (index 0), e.g. the empty "Новые" state.
	const footer = root.querySelector('.visits-panel__footer')
	if (footer) {
		const onTabsChange = (e) => {
			footer.style.display = (e.detail?.index ?? 0) === 0 ? '' : 'none'
		}
		root.addEventListener('tabs:change', onTabsChange)
		disposers.push(() => {
			root.removeEventListener('tabs:change', onTabsChange)
			footer.style.display = ''
		})
	}

	// --- Page-size dropdown (20 / 50 / 100) ---
	root.querySelectorAll('[data-page-size]').forEach((select) => {
		const trigger = select.querySelector('[data-page-size-trigger]')
		const panel = select.querySelector('[data-page-size-panel]')
		const valueEl = select.querySelector('[data-page-size-value]')
		const options = [...select.querySelectorAll('.page-size__option')]
		if (!trigger || !panel) return

		let open = false
		const setOpen = (state) => {
			open = state
			select.classList.toggle('is-open', open)
			trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
			panel.setAttribute('aria-hidden', open ? 'false' : 'true')
		}

		const onTrigger = (e) => {
			e.preventDefault()
			e.stopPropagation()
			setOpen(!open)
		}
		const onOption = (e) => {
			const option = e.target.closest('.page-size__option')
			if (!option) return
			options.forEach((o) => o.classList.toggle('is-active', o === option))
			if (valueEl) valueEl.textContent = option.dataset.value
			select.dispatchEvent(
				new CustomEvent('pagesize:change', {
					bubbles: true,
					detail: { value: option.dataset.value },
				})
			)
			setOpen(false)
		}
		const onDocDown = (e) => {
			if (open && !select.contains(e.target)) setOpen(false)
		}
		const onKey = (e) => {
			if (open && e.key === 'Escape') {
				e.preventDefault()
				setOpen(false)
				trigger.focus({ preventScroll: true })
			}
		}

		setOpen(false)
		trigger.addEventListener('click', onTrigger)
		panel.addEventListener('click', onOption)
		document.addEventListener('pointerdown', onDocDown, true)
		document.addEventListener('keydown', onKey, true)
		disposers.push(() => {
			trigger.removeEventListener('click', onTrigger)
			panel.removeEventListener('click', onOption)
			document.removeEventListener('pointerdown', onDocDown, true)
			document.removeEventListener('keydown', onKey, true)
			select.classList.remove('is-open')
		})
	})

	// --- Working pagination + page-size for the visits table ---
	const disposePagination = initVisitsPagination(root)
	if (disposePagination) disposers.push(disposePagination)

	return () => {
		disposers.forEach((dispose) => dispose())
		delete root.__visitsPanelBound
	}
}

// Builds a demo dataset from the static template rows, then paginates it for
// real. Page-size (20/50/100) and page navigation both reflow the visible rows.
function initVisitsPagination(root) {
	const tbody = root.querySelector('.visits-table tbody')
	const nav = root.querySelector('.ui-pagination')
	const totalEl = root.querySelector('.visits-panel__total-text')
	if (!tbody || !nav) return null

	const baseRows = [...tbody.querySelectorAll('tr')]
	if (!baseRows.length) return null

	const TOTAL = 124
	const pad = (n) => String(n).padStart(2, '0')
	const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
	const start = new Date(2026, 1, 12)

	// Clone the templates up to TOTAL, giving each a distinct (descending) date.
	const rows = []
	for (let i = 0; i < TOTAL; i++) {
		const row = baseRows[i % baseRows.length].cloneNode(true)
		const dateLink = row.querySelector('.visits-table__link')
		if (dateLink) {
			const d = new Date(start)
			d.setDate(d.getDate() - i)
			dateLink.textContent = fmtDate(d)
		}
		rows.push(row)
	}
	tbody.replaceChildren(...rows)

	const valueEl = root.querySelector('[data-page-size-value]')
	let pageSize = parseInt(valueEl?.textContent, 10) || 20
	let page = 1
	const pageCount = () => Math.max(1, Math.ceil(rows.length / pageSize))

	if (totalEl) totalEl.innerHTML = `Всего: <span>${rows.length}</span>`

	function renderRows() {
		const from = (page - 1) * pageSize
		const to = from + pageSize
		rows.forEach((row, i) => {
			row.style.display = i >= from && i < to ? '' : 'none'
		})
	}

	// On mobile the row is narrow, so we cap how many slots are shown — but
	// keep that count constant and spend the free space near the edges
	// (1 2 3 … N / 1 … k … N / 1 … N-2 N-1 N) instead of leaving gaps.
	const mqMobile = window.matchMedia('(max-width: 743.98px)')

	function pageItems() {
		const total = pageCount()
		if (total <= 1) return [1]

		if (mqMobile.matches) {
			// BUDGET = max items (page numbers + ellipses) between the nav buttons
			const BUDGET = 5
			const pages = new Set([1, total, page])
			const slotCount = () => {
				const s = [...pages].sort((a, b) => a - b)
				let n = s.length
				for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > 1) n++
				return n
			}
			// grow outward from the current page, alternating sides, until the
			// next number would push us past the budget
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
			const items = []
			for (let i = 0; i < sorted.length; i++) {
				if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('…')
				items.push(sorted[i])
			}
			return items
		}

		// Desktop: first, last and the current page ±1.
		const items = [1]
		const left = Math.max(2, page - 1)
		const right = Math.min(total - 1, page + 1)
		if (left > 2) items.push('…')
		for (let i = left; i <= right; i++) items.push(i)
		if (right < total - 1) items.push('…')
		items.push(total)
		return items
	}

	function renderNav() {
		const total = pageCount()
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
				dots.innerHTML = '<svg aria-hidden="true" focusable="false" width="16" height="16"><use href="#icon-three-dots"></use></svg>'
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

	function goTo(p) {
		page = Math.min(Math.max(1, p), pageCount())
		renderRows()
		renderNav()
	}

	const onNavClick = (e) => {
		const item = e.target.closest('.ui-pagination__item')
		if (!item || item.disabled) return
		if (item.dataset.page) goTo(parseInt(item.dataset.page, 10))
		else if (item.dataset.next) goTo(page + 1)
		else if (item.dataset.prev) goTo(page - 1)
	}
	const onPageSize = (e) => {
		const v = parseInt(e.detail?.value, 10)
		if (!v) return
		pageSize = v
		page = 1
		renderRows()
		renderNav()
	}

	// --- Column sorting over the FULL dataset (keeps pagination correct) ---
	const baseOrder = rows.slice()
	const headers = [...root.querySelectorAll('.visits-table__th[data-sort-type]')]
	let sortTh = null
	let sortDir = 0 // 1 asc, -1 desc, 0 none
	const sortDisposers = []
	const toNum = (t) => {
		const n = parseFloat(String(t).replace(',', '.').replace(/[^\d.-]/g, ''))
		return Number.isNaN(n) ? 0 : n
	}
	const toDate = (t) => {
		const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(t))
		return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0
	}
	const colText = (row, i) => (row.children[i]?.textContent || '').trim()

	const applySort = () => {
		if (!sortTh || sortDir === 0) {
			rows.splice(0, rows.length, ...baseOrder)
		} else {
			const i = [...sortTh.parentElement.children].indexOf(sortTh)
			const type = sortTh.dataset.sortType
			rows.sort((a, b) => {
				const av = colText(a, i)
				const bv = colText(b, i)
				let cmp
				if (type === 'date') cmp = toDate(av) - toDate(bv)
				else if (type === 'number') cmp = toNum(av) - toNum(bv)
				else cmp = av.localeCompare(bv, 'ru')
				return cmp * sortDir
			})
		}
		tbody.replaceChildren(...rows)
		page = 1 // re-sort returns to the first page so the order is obvious
		renderRows()
		renderNav()
	}

	headers.forEach((th) => {
		const onClick = () => {
			if (sortTh !== th) {
				sortTh = th
				sortDir = 1
			} else {
				sortDir = sortDir === 1 ? -1 : sortDir === -1 ? 0 : 1
			}
			if (sortDir === 0) sortTh = null
			headers.forEach((h) => h.classList.remove('is-asc', 'is-desc'))
			if (sortDir === 1) th.classList.add('is-asc')
			else if (sortDir === -1) th.classList.add('is-desc')
			applySort()
		}
		th.addEventListener('click', onClick)
		sortDisposers.push(() => th.removeEventListener('click', onClick))
	})

	// re-render the page list when crossing the mobile breakpoint
	const onMqChange = () => renderNav()

	nav.addEventListener('click', onNavClick)
	root.addEventListener('pagesize:change', onPageSize)
	mqMobile.addEventListener('change', onMqChange)

	renderRows()
	renderNav()

	return () => {
		nav.removeEventListener('click', onNavClick)
		root.removeEventListener('pagesize:change', onPageSize)
		mqMobile.removeEventListener('change', onMqChange)
		sortDisposers.forEach((d) => d())
		headers.forEach((h) => h.classList.remove('is-asc', 'is-desc'))
	}
}

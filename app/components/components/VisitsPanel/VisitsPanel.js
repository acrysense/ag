import { mountTabs } from '@/utils/tabs'

export default (root) => {
	if (!root || root.__visitsPanelBound) return
	root.__visitsPanelBound = true

	const disposers = []

	// --- Segmented tabs (История / Новые) — reuse the project's tabs util ---
	const disposeTabs = mountTabs(root)
	if (disposeTabs) disposers.push(disposeTabs)

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

	if (totalEl) totalEl.textContent = `Всего: ${rows.length}`

	function renderRows() {
		const from = (page - 1) * pageSize
		const to = from + pageSize
		rows.forEach((row, i) => {
			row.style.display = i >= from && i < to ? '' : 'none'
		})
	}

	function pageItems() {
		const total = pageCount()
		const items = [1]
		const left = Math.max(2, page - 1)
		const right = Math.min(total - 1, page + 1)
		if (left > 2) items.push('…')
		for (let i = left; i <= right; i++) items.push(i)
		if (right < total - 1) items.push('…')
		if (total > 1) items.push(total)
		return items
	}

	function renderNav() {
		const total = pageCount()
		nav.replaceChildren()
		pageItems().forEach((it) => {
			if (it === '…') {
				const dots = document.createElement('span')
				dots.className = 'ui-pagination__dots'
				dots.textContent = '…'
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
	}
	const onPageSize = (e) => {
		const v = parseInt(e.detail?.value, 10)
		if (!v) return
		pageSize = v
		page = 1
		renderRows()
		renderNav()
	}

	nav.addEventListener('click', onNavClick)
	root.addEventListener('pagesize:change', onPageSize)

	renderRows()
	renderNav()

	return () => {
		nav.removeEventListener('click', onNavClick)
		root.removeEventListener('pagesize:change', onPageSize)
	}
}

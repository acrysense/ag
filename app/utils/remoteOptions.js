// Lazy, paged option loading for selects/filters (AG-1). Instead of the backend
// inlining thousands of <option>/<label> into the page, a field opts in with
// data-options-src="/ajax/options.php?type=employee" and this module fetches
// options on first open, searches server-side (debounced), and appends further
// pages on scroll. Endpoint contract: docs/ag-1-options-endpoint.md.
//
// Backward compatible: fields WITHOUT data-options-src keep their inline options
// and never touch this module.

export const escOpt = (s) =>
	String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const DEBOUNCE_MS = 250
const NEAR_BOTTOM_PX = 120

// scrollEl: element that scrolls (the options viewport)
// listEl:   element whose innerHTML holds the option nodes
// opts.src:        base URL (may already carry ?type=…)
// opts.optionHTML: (item) => HTML string for one option (caller escapes)
// opts.extraParams:() => ({key:val}) merged into every request (e.g. {manager})
// opts.states:     { loading, empty, error } optional message elements to toggle
// opts.onUpdate:   called after the list DOM changes
export function mountRemoteOptions(scrollEl, listEl, opts) {
	const { src, optionHTML, extraParams, states = {}, onUpdate } = opts
	let page = 1
	let query = ''
	let total = 0
	let loaded = 0
	let hasMore = true
	let busy = false
	let started = false
	let reqId = 0
	let debTimer = null

	const setState = (k, on) => {
		if (states[k]) states[k].hidden = !on
	}
	const buildURL = () => {
		const u = new URL(src, location.origin)
		u.searchParams.set('q', query)
		u.searchParams.set('page', String(page))
		const extra = extraParams?.() || {}
		for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') u.searchParams.set(k, String(v))
		return u.toString()
	}

	const fetchPage = async (reset) => {
		// a reset (open / new search) must NOT be blocked by an in-flight load-more —
		// bumping reqId below invalidates that older response, so we always proceed.
		// only pagination (reset=false) is guarded by busy / hasMore.
		if (!reset && (busy || !hasMore)) return
		const mine = ++reqId
		busy = true
		setState('error', false)
		if (reset) setState('loading', true)
		try {
			const res = await fetch(buildURL(), { credentials: 'include' })
			if (!res.ok) throw new Error(String(res.status))
			const data = await res.json()
			if (mine !== reqId) return // a newer request superseded this one
			const items = Array.isArray(data.items) ? data.items : []
			total = Number.isFinite(data.total) ? data.total : items.length
			hasMore = data.hasMore ?? loaded + items.length < total
			const html = items.map(optionHTML).join('')
			if (reset) {
				listEl.innerHTML = html
				loaded = items.length
			} else {
				listEl.insertAdjacentHTML('beforeend', html)
				loaded += items.length
			}
			setState('empty', loaded === 0)
			onUpdate?.()
		} catch (e) {
			if (mine !== reqId) return
			setState('error', true)
			hasMore = false
		} finally {
			if (mine === reqId) {
				busy = false
				setState('loading', false)
			}
		}
	}

	const loadFirst = () => {
		if (started) return
		started = true
		page = 1
		loaded = 0
		hasMore = true
		fetchPage(true)
	}

	const search = (q) => {
		query = String(q || '')
		clearTimeout(debTimer)
		debTimer = setTimeout(() => {
			page = 1
			loaded = 0
			hasMore = true
			fetchPage(true)
		}, DEBOUNCE_MS)
	}

	// re-fetch from scratch (e.g. a dependency like the selected manager changed)
	const refresh = () => {
		started = true
		page = 1
		loaded = 0
		hasMore = true
		query = ''
		fetchPage(true)
	}

	const onScroll = () => {
		if (busy || !hasMore) return
		if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - NEAR_BOTTOM_PX) {
			page += 1
			fetchPage(false)
		}
	}
	scrollEl.addEventListener('scroll', onScroll, { passive: true })

	return {
		loadFirst,
		search,
		refresh,
		get total() {
			return total
		},
		destroy() {
			clearTimeout(debTimer)
			reqId++ // invalidate any in-flight response
			scrollEl.removeEventListener('scroll', onScroll)
		},
	}
}

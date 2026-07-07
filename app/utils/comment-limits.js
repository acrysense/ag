// Shared limits for the inline comment editors (tasks list + visit checklist):
// cap the length so the box can't grow without bound, and cap the number of
// line breaks so it can't be spammed into a wall of blank lines. Purely
// client-side — the saved value is still a plain string, so no backend change.
export const MAX_COMMENT_LEN = 500
export const MAX_COMMENT_BREAKS = 10

// Block line breaks past the cap: typing Enter is a no-op at the limit, and a
// paste that carries too many breaks has the surplus stripped (then autosize is
// re-run on the cleaned value). Character count is enforced natively by the
// field's maxlength attribute.
export const limitLineBreaks = (el, max = MAX_COMMENT_BREAKS) => {
	if (!el) return
	const breaks = (s) => (s.match(/\n/g) || []).length
	el.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.isComposing && breaks(el.value) >= max) e.preventDefault()
	})
	let guard = false
	el.addEventListener('input', () => {
		if (guard || breaks(el.value) <= max) return
		guard = true
		const before = el.value
		const pos = el.selectionStart
		let n = 0
		el.value = before.replace(/\n/g, (m) => (++n <= max ? m : ''))
		const np = Math.max(0, pos - (before.length - el.value.length))
		try {
			el.setSelectionRange(np, np)
		} catch {}
		el.dispatchEvent(new Event('input', { bubbles: true })) // re-run autosize
		guard = false
	})
}

// Checklist-result colour by completion scale, agreed with the backend:
//   ≥95% → green, 80–95% → yellow, <80% → red.
// Accepts a «X / Y» string (e.g. "64 / 100") or a bare number/percent. Returns a
// tone key for the .visits-score--{tone} class, or '' when there's no usable value.
export function scoreTone(value) {
	const s = String(value ?? '').trim()
	if (!s) return ''
	const m = /(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(s)
	let pct
	if (m) {
		const num = parseFloat(m[1].replace(',', '.'))
		const den = parseFloat(m[2].replace(',', '.'))
		if (!den) return ''
		pct = (num / den) * 100
	} else {
		const num = parseFloat(s.replace(',', '.'))
		if (Number.isNaN(num)) return ''
		pct = num // already a percentage
	}
	if (pct >= 95) return 'green'
	if (pct >= 80) return 'yellow'
	return 'red'
}

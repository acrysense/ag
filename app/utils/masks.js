import Inputmask from 'inputmask'

export function applyMasks(root = document) {
	const els = root.matches?.('[data-mask]') ? [root] : [...root.querySelectorAll('[data-mask]')]
	if (!els.length) return () => {}
	const applied = []

	const common = {
		showMaskOnFocus: true,
		showMaskOnHover: false,
		rightAlign: false,
		clearIncomplete: false,
	}

	els.forEach((el) => {
		if (el.dataset.maskApplied === '1') return

		const mask = el.getAttribute('data-mask')
		if (!mask) return

		try {
			Inputmask({ mask, ...common }).mask(el)
			el.dataset.maskApplied = '1'
			applied.push(el)
		} catch (e) {
			console.error('[masks] apply error', e)
		}
	})

	return () => {
		applied.forEach((el) => {
			el.inputmask?.remove()
			delete el.dataset.maskApplied
		})
	}
}

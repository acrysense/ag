import 'virtual:svg-icons-register'
import '@/assets/styles/main.scss'
import { autosize } from '@/utils/autosize';

const modules = import.meta.glob('/components/**/{index,*.js}', { eager: false })

const toPascal = (s) =>
	s.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toUpperCase())
const toKebab = (s) =>
	s
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[_\s]+/g, '-')
		.toLowerCase()

function candidates(name, group) {
	const P = toPascal(name)
	const K = toKebab(name)
	const base = group ? `/components/${group}` : '/components'
	return [
		`${base}/${name}/${name}.js`,
		`${base}/${name}/index.js`,
		`${base}/${P}/${P}.js`,
		`${base}/${P}/index.js`,
		`${base}/${K}/${K}.js`,
		`${base}/${K}/index.js`,
	]
}

document.querySelectorAll('[data-module]').forEach(async (el) => {
	let name = el.dataset.module?.trim()
	let group = el.dataset.path?.trim() || ''
	if (!name) return

	if (name.includes('/')) {
		const [g, n] = name.split('/')
		group = g || group
		name  = n || name
	}

	const tries = candidates(name, group)
	const key = tries.find((p) => modules[p])

	if (!key) {
		console.warn('[module] not found', { name, group, tried: tries })
		return
	}

	try {
		const mod = await modules[key]()
		mod?.default?.(el)
	} catch (e) {
		console.error('[module] failed to init', key, e)
	}
})

document.addEventListener('DOMContentLoaded', () => {
	autosize(document);
});
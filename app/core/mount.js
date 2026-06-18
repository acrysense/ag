const modules = import.meta.glob(
	[
		'/components/**/{index,*.js}',
		'!/components/components/AvatarCropModal/**',
		'!/components/components/PhotoViewer/**',
	],
	{ eager: false }
)
const mounted = new WeakMap()

const toPascal = (value) =>
	value
		.replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
		.replace(/^(.)/, (char) => char.toUpperCase())
const toKebab = (value) =>
	value
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[_\s]+/g, '-')
		.toLowerCase()

function candidates(name, group) {
	const pascalName = toPascal(name)
	const kebabName = toKebab(name)
	const base = group ? `/components/${group}` : '/components'

	return [
		`${base}/${name}/${name}.js`,
		`${base}/${name}/index.js`,
		`${base}/${pascalName}/${pascalName}.js`,
		`${base}/${pascalName}/index.js`,
		`${base}/${kebabName}/${kebabName}.js`,
		`${base}/${kebabName}/index.js`,
	]
}

function collect(root) {
	const items = root.matches?.('[data-module]') ? [root] : []
	return items.concat([...(root.querySelectorAll?.('[data-module]') || [])])
}

async function initElement(el) {
	let name = el.dataset.module?.trim()
	let group = el.dataset.path?.trim() || ''
	if (!name) return

	if (name.includes('/')) {
		const [nextGroup, nextName] = name.split('/')
		group = nextGroup || group
		name = nextName || name
	}

	const attempts = candidates(name, group)
	const key = attempts.find((candidate) => modules[candidate])
	if (!key) {
		console.warn('[module] not found', { name, group, tried: attempts })
		return
	}

	const module = await modules[key]()
	const returnedDispose = await module?.default?.(el)
	const dispose = typeof returnedDispose === 'function' ? returnedDispose : el.__dispose

	return typeof dispose === 'function'
		? () => {
				dispose()
				delete el.__dispose
			}
		: null
}

export async function mount(root = document) {
	const elements = collect(root).filter((el) => !mounted.has(el))

	await Promise.all(
		elements.map(async (el) => {
			mounted.set(el, null)
			try {
				const dispose = await initElement(el)
				if (!mounted.has(el)) {
					dispose?.()
					return
				}
				mounted.set(el, dispose)
			} catch (error) {
				mounted.delete(el)
				console.error('[module] failed to init', el.dataset.module, error)
			}
		})
	)
}

export function unmount(root = document) {
	for (const el of collect(root).reverse()) {
		if (!mounted.has(el)) continue
		try {
			mounted.get(el)?.()
		} catch (error) {
			console.error('[module] failed to dispose', el.dataset.module, error)
		} finally {
			mounted.delete(el)
			delete el.__bound
			delete el.__dropdownBound
			delete el.__galleryBound
			delete el.__motivationBound
		}
	}
}

export function requestMount(root = document) {
	document.dispatchEvent(new CustomEvent('ui:mount', { detail: { root } }))
}

export function requestUnmount(root = document) {
	document.dispatchEvent(new CustomEvent('ui:unmount', { detail: { root } }))
}

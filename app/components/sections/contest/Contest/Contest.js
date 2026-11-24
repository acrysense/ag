// Шкалы шагов конкурса. Каждый шаг [data-contest-step] даёт план (data-plan) и факт (data-fact) в
// упаковках; по ним строятся волнистая шкала из делений, рыбка с облачком, цель в конце и итог
// под шкалой («Выполнено …», «Осталось …», цена деления).
//
// Правила:
// - цена деления: план ≤ 20 → 1 уп., ≤ 50 → 2, ≤ 125 → 5, больше → 10; делений = план / цена;
//   подписи — у каждого деления при цене 1, иначе каждые 5 делений;
// - деление i заполнено на clamp(факт / цена − i, 0…1); факт больше плана — шкала полная;
// - числа округляются до 2 знаков, «,00» не пишется, разделитель — запятая;
// - факт (округлённый до 2 знаков) ≥ план — цель достигнута: рыбка и облачко уходят, у цели
//   свечение и блёстки.
//
// Движение: при появлении на экране рыбка доплывает от 0 до факта, заливка и число растут вместе
// с ней; в покое рыбка покачивается, за хвостом пузырьки, по заливке проходит блик. Клик по рыбке
// (или Enter) — проплыв по всей шкале и обратно; клик над шкалой — корм, рыбка подплывает и
// возвращается. prefers-reduced-motion — всё сразу на местах, без движения.

const NS = 'http://www.w3.org/2000/svg'
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

const PRESETS = {
	desktop: {
		h: 132,
		cy: 72,
		band: 26,
		amp: 7,
		gap: 4,
		left: 58,
		right: 86,
		goal: 72,
		goalGap: 50,
		fish: 1,
		tickTop: 100,
		major: 8,
		minor: 5,
		tickW: 1.5,
		label: 125,
		shine: 3,
		lift: 24,
	},
	mobile: {
		h: 100,
		cy: 54,
		band: 18,
		amp: 5,
		gap: 2,
		left: 42,
		right: 52,
		goal: 46,
		goalGap: 29,
		fish: 0.6875,
		tickTop: 74,
		major: 6,
		minor: 4,
		tickW: 1,
		label: 94,
		shine: 2,
		lift: 21,
	},
}
const DESKTOP_FROM = 1024
const WAVES = 3
// Рыбка 64×46: нос в (62, 23), центр тела — 37,5
const NOSE = 24.5

const FISH = (grad, fin) => `
	<path class="contest-fish__tail ${fin}" d="M15 23C10 16 5 10 2 9C0 15 0 31 2 37C5 36 10 30 15 23Z"/>
	<path class="${fin}" d="M27 9C29 2 37 0 44 6L40 11L27 9Z"/>
	<path class="${fin}" d="M28 37C29 42 34 45 38 41L36 37H28Z"/>
	<path d="M13 23C16 11 30 5 44 7C55 9 62 16 62 23C62 30 55 37 44 39C30 41 16 35 13 23Z" fill="url(#${grad})"/>
	<path d="M22 28C30 34 44 35 54 31C50 36 44 38 38 38C30 38 25 34 22 28Z" fill="#fff" fill-opacity=".28"/>
	<path class="${fin}" d="M30 22C33 17 40 18 40 23C40 28 34 29 30 22Z" fill-opacity=".55"/>
	<path d="M27 13C31 10.5 35 10 39 10.5" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2" stroke-linecap="round"/>
	<circle cx="50" cy="19" r="5.5" fill="#fff"/>
	<circle cx="51.2" cy="19.4" r="3" fill="#0f1a24"/>
	<circle cx="52.3" cy="18.2" r="1" fill="#fff"/>
	<path d="M55 28C57 29.5 59 29.5 60.5 28" fill="none" stroke="#0f1a24" stroke-width="1.6" stroke-linecap="round"/>`

const SPARKLE =
	'M6 0C6.6 3.6 8.4 5.4 12 6C8.4 6.6 6.6 8.4 6 12C5.4 8.4 3.6 6.6 0 6C3.6 5.4 5.4 3.6 6 0Z'
// Блёстки вокруг цели 72: центр относительно центра цели и размер
const SPARKLES = [
	[-26, -22, 12],
	[27, -27, 10],
	[30, 26, 12],
	[-30, 22, 8],
]
const CHECK =
	'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="8" fill="#e9a600"/><path d="M4.5 8.2 7 10.5l4.5-4.7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

let uid = 0

const num = (value) => {
	const n = parseFloat(
		String(value ?? '')
			.replace(/\s/g, '')
			.replace(',', '.')
	)
	return Number.isFinite(n) ? n : 0
}

export const format = (value) => {
	let text = (Math.round(value * 100) / 100).toFixed(2)
	if (text.endsWith('.00')) text = text.slice(0, -3)
	return text.replace('.', ',').replace(/^-0$/, '0')
}

export const priceOf = (plan) => (plan <= 20 ? 1 : plan <= 50 ? 2 : plan <= 125 ? 5 : 10)

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2

const el = (name, attrs = {}, parent) => {
	const node = document.createElementNS(NS, name)
	for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
	parent?.append(node)
	return node
}

function createStep(step, index) {
	const scale = step.querySelector('[data-contest-scale]')
	const summary = step.querySelector('[data-contest-summary]')
	const plan = num(step.dataset.plan)
	const fact = Math.max(0, Math.round(num(step.dataset.fact) * 100) / 100)
	if (!scale || plan <= 0) return { start() {}, dispose() {} }

	const id = `contest-${++uid}`
	const price = priceOf(plan)
	const divisions = plan / price
	const reached = fact >= plan
	const target = Math.min(fact, plan)
	const dir = index % 2 ? -1 : 1

	const frames = new Set()
	let disposed = false
	let geo = null
	let shown = 0 // показанное значение (растёт при появлении)
	let fishX = 0 // центр рыбки
	let fishDir = 1 // 1 — вправо, -1 — влево; между ними — разворот
	let busy = false
	let started = false

	// Анимация на кадрах: onFrame(t, eased); отменяется при dispose
	const tween = (duration, ease, onFrame) =>
		new Promise((resolve) => {
			const t0 = performance.now()
			const tick = (now) => {
				frames.delete(raf)
				if (disposed) return resolve(false)
				const t = clamp((now - t0) / duration, 0, 1)
				onFrame(t, ease(t))
				if (t < 1) {
					raf = requestAnimationFrame(tick)
					frames.add(raf)
				} else resolve(true)
			}
			let raf = requestAnimationFrame(tick)
			frames.add(raf)
		})

	// Итог под шкалой
	const renderSummary = () => {
		if (!summary) return
		const status = document.createElement('p')
		status.className = 'contest-step__status'
		const chip = document.createElement('span')
		chip.className = 'contest-step__chip'
		if (reached) {
			chip.classList.add('contest-step__chip--reached')
			chip.innerHTML = CHECK
			chip.append(`Цель достигнута: ${format(fact)} из ${format(plan)} уп.`)
			status.append(chip)
		} else {
			chip.textContent = `Выполнено ${format(fact)} из ${format(plan)} уп.`
			const rest = document.createElement('span')
			rest.className = 'contest-step__rest'
			rest.textContent = `Осталось ${format(plan - fact)} уп.`
			status.append(chip, rest)
		}
		const legend = document.createElement('p')
		legend.className = 'contest-step__legend'
		legend.textContent = `1 деление = ${format(price)} уп.`
		summary.replaceChildren(status, legend)
	}

	// Геометрия по ширине шкалы
	const measure = () => {
		const width = scale.clientWidth
		const p = window.innerWidth >= DESKTOP_FROM ? PRESETS.desktop : PRESETS.mobile
		const x0 = p.left
		const x1 = Math.max(x0 + 40, width - p.right)
		const length = x1 - x0
		const pitch = (length + p.gap) / divisions
		const wave = (x) => p.cy + dir * p.amp * Math.sin((2 * Math.PI * WAVES * (x - x0)) / length)
		const cellW = (i) => Math.min(pitch, (divisions - i) * pitch) - p.gap
		const xOf = (value) => {
			if (value <= 0) return x0
			if (value >= plan) return x1
			const u = value / price
			const i = Math.floor(u)
			return x0 + i * pitch + (u - i) * cellW(i)
		}
		return { p, width, x0, x1, length, pitch, wave, cellW, xOf, k: p.fish }
	}

	const cellPath = (g, i, cells) => {
		const { p, x0, pitch, wave, cellW } = g
		const xa = x0 + i * pitch
		const xb = xa + cellW(i)
		const r = p.band / 2
		const steps = Math.max(2, Math.ceil((xb - xa) / 3))
		const top = []
		const bottom = []
		for (let s = 0; s <= steps; s++) {
			const x = xa + ((xb - xa) * s) / steps
			const y = wave(x)
			top.push(`${x.toFixed(2)} ${(y - r).toFixed(2)}`)
			bottom.unshift(`${x.toFixed(2)} ${(y + r).toFixed(2)}`)
		}
		let d = `M${top.join('L')}`
		d += i === cells - 1 ? `A${r} ${r} 0 0 1 ${bottom[0]}` : `L${bottom[0]}`
		d += `L${bottom.slice(1).join('L')}`
		d += i === 0 ? `A${r} ${r} 0 0 1 ${top[0]}Z` : 'Z'
		return d
	}

	// Ссылки на части SVG
	let svg
	let clipRect
	let fishOuter
	let fishFlip
	let fishGroup
	let foodLayer
	let cloud
	let pill
	let fishButton

	const build = () => {
		geo = measure()
		const { p, width, x0, x1, wave, k } = geo
		const cells = Math.ceil(divisions - 1e-9)
		const top = p.cy - p.band / 2 - p.amp

		svg = el('svg', {
			width,
			height: p.h,
			viewBox: `0 0 ${width} ${p.h}`,
			'aria-hidden': 'true',
			focusable: 'false',
		})
		const defs = el('defs', {}, svg)
		const linear = (gid, a, b, attrs) => {
			const grad = el(
				'linearGradient',
				{ id: gid, gradientUnits: 'userSpaceOnUse', ...attrs },
				defs
			)
			el('stop', { class: a }, grad)
			el('stop', { class: b, offset: '1' }, grad)
		}
		linear(`${id}-fill`, 'contest-scale__stop-top', 'contest-scale__stop-bottom', {
			x1: 0,
			y1: top,
			x2: 0,
			y2: top + p.band + 2 * p.amp,
		})
		linear(`${id}-fish`, 'contest-fish__body-top', 'contest-fish__body-bottom', {
			x1: 32,
			y1: 6,
			x2: 32,
			y2: 40,
		})
		linear(`${id}-gold`, 'contest-goal__body-top', 'contest-goal__body-bottom', {
			x1: 32,
			y1: 6,
			x2: 32,
			y2: 40,
		})
		const glint = el('linearGradient', { id: `${id}-glint`, x1: 0, x2: 1, y1: 0, y2: 0 }, defs)
		el('stop', { 'stop-color': '#fff', 'stop-opacity': 0 }, glint)
		el('stop', { 'stop-color': '#fff', 'stop-opacity': 0.45, offset: '.5' }, glint)
		el('stop', { 'stop-color': '#fff', 'stop-opacity': 0, offset: '1' }, glint)
		const glow = el('radialGradient', { id: `${id}-glow` }, defs)
		el('stop', { class: 'contest-goal__glow-stop' }, glow)
		el('stop', { class: 'contest-goal__glow-stop', offset: '1', 'stop-opacity': 0 }, glow)
		const shadow = el(
			'filter',
			{ id: `${id}-shadow`, x: '-5%', y: '-50%', width: '110%', height: '200%' },
			defs
		)
		el(
			'feDropShadow',
			{ dx: 0, dy: 3, stdDeviation: 3, 'flood-color': '#0a6f8a', 'flood-opacity': 0.14 },
			shadow
		)
		const clip = el('clipPath', { id: `${id}-clip` }, defs)
		clipRect = el('rect', { x: 0, y: 0, width: 0, height: p.h }, clip)
		// Форма ленты — чтобы блик не выходил за деления
		const bandClip = el('clipPath', { id: `${id}-band` }, defs)

		// Лента: пустые деления, поверх — заливка до факта, блик и переливание
		const track = el('g', { filter: `url(#${id}-shadow)` }, svg)
		const fill = el('g', { 'clip-path': `url(#${id}-clip)` })
		for (let i = 0; i < cells; i++) {
			const d = cellPath(geo, i, cells)
			el('path', { class: 'contest-scale__cell', d }, track)
			el('path', { d, fill: `url(#${id}-fill)`, stroke: `url(#${id}-fill)` }, fill)
			el('path', { d }, bandClip)
		}
		track.append(fill)
		let shine = ''
		for (let x = x0; x <= x1; x += 4)
			shine += `${shine ? 'L' : 'M'}${x.toFixed(1)} ${(wave(x) - p.band * 0.27).toFixed(1)}`
		el('path', { class: 'contest-scale__shine', d: shine, 'stroke-width': p.shine }, fill)
		const glintLayer = el('g', { 'clip-path': `url(#${id}-band)` }, fill)
		const glintRect = el(
			'rect',
			{
				class: 'contest-scale__glint',
				x: x0,
				y: top,
				width: 120,
				height: p.band + 2 * p.amp,
				fill: `url(#${id}-glint)`,
			},
			glintLayer
		)
		glintRect.style.setProperty('--glint-to', `${x1 - x0 + 120}px`)

		// Риски и подписи
		const ticks = el('g', {}, svg)
		const whole = Math.floor(divisions + 1e-9)
		const marks = []
		for (let i = 0; i <= whole; i++) marks.push(i * price)
		if (Math.abs(marks[marks.length - 1] - plan) > 1e-9) marks.push(plan)
		marks.forEach((value, i) => {
			const isLast = i === marks.length - 1
			const labelled = price === 1 || i % 5 === 0 || isLast
			const x = geo.xOf(value)
			el(
				'rect',
				{
					class: `contest-scale__tick${labelled ? '' : ' contest-scale__tick--minor'}`,
					x: (x - p.tickW / 2).toFixed(2),
					y: p.tickTop,
					width: p.tickW,
					height: labelled ? p.major : p.minor,
				},
				ticks
			)
			if (labelled)
				el(
					'text',
					{ class: 'contest-scale__label', x: x.toFixed(2), y: p.label },
					ticks
				).textContent = format(value)
		})

		// Цель в конце шкалы
		const g = p.goal / 72
		const goal = el(
			'g',
			{ class: 'contest-goal', transform: `translate(${x1 + p.goalGap} ${wave(x1)})` },
			svg
		)
		el('circle', { class: 'contest-goal__glow', r: p.goal / 2, fill: `url(#${id}-glow)` }, goal)
		const ringR = 33 * g
		const dash = (2 * Math.PI * ringR) / 20
		el(
			'circle',
			{
				class: 'contest-goal__ring',
				r: ringR,
				'stroke-dasharray': `${(dash * 0.6).toFixed(2)} ${(dash * 0.4).toFixed(2)}`,
				'stroke-width': Math.max(1.5, 2 * g),
			},
			goal
		)
		const goalBob = el('g', { class: 'contest-goal__bob' }, goal)
		const goalFish = el('g', { class: 'contest-goal__fish' }, goalBob)
		el('g', { transform: `scale(${(48 / 64) * g}) translate(-37.5 -23)` }, goalFish).innerHTML =
			FISH(`${id}-gold`, 'contest-goal__fin')
		for (const [sx, sy, size] of SPARKLES) {
			const s = size * g
			el(
				'path',
				{
					class: 'contest-goal__sparkle',
					d: SPARKLE,
					transform: `translate(${(sx * g - s / 2).toFixed(2)} ${(sy * g - s / 2).toFixed(2)}) scale(${s / 12})`,
				},
				goal
			)
		}

		// Рыбка шага с пузырьками за хвостом
		fishOuter = el('g', { class: 'contest-fish' }, svg)
		fishGroup = el('g', { class: 'contest-fish__bob' }, fishOuter)
		fishFlip = el('g', {}, fishGroup)
		const body = el('g', { transform: `scale(${k}) translate(-37.5 -23)` }, fishFlip)
		el('circle', { class: 'contest-fish__trail', cx: 4, cy: 20, r: 3.5 }, body)
		el('circle', { class: 'contest-fish__trail', cx: -3, cy: 9, r: 2.5 }, body)
		el('circle', { class: 'contest-fish__trail', cx: 4, cy: 1, r: 1.75 }, body)
		body.insertAdjacentHTML('beforeend', FISH(`${id}-fish`, 'contest-fish__fin'))

		foodLayer = el('g', {}, svg)

		// Облачко и кнопка «поплавать» — HTML поверх SVG
		cloud = document.createElement('span')
		cloud.className = 'contest-scale__cloud'
		pill = document.createElement('span')
		pill.className = 'contest-scale__pill'
		cloud.append(pill)

		fishButton = document.createElement('button')
		fishButton.type = 'button'
		fishButton.className = 'contest-scale__fish-btn'
		fishButton.setAttribute('aria-label', 'Рыбка: проплыть по шкале')
		fishButton.style.setProperty('--w', `${64 * k}px`)
		fishButton.style.setProperty('--h', `${46 * k}px`)
		fishButton.hidden = reached || motion.matches

		scale.replaceChildren(svg, cloud, fishButton)
	}

	// Положение заливки, рыбки, облачка
	const home = () => geo.xOf(shown) - NOSE * geo.k

	const placeFish = (x, lift = 0) => {
		const { wave, k } = geo
		fishX = x
		const dx = 2
		const angle = (Math.atan2(wave(x + dx) - wave(x - dx), 2 * dx) * 180) / Math.PI
		const y = wave(x) + lift
		fishOuter.setAttribute(
			'transform',
			`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)})`
		)
		fishFlip.setAttribute('transform', `scale(${fishDir.toFixed(3)} 1)`)
		fishButton.style.setProperty('--x', `${x}px`)
		fishButton.style.setProperty('--y', `${y}px`)
		cloud.style.setProperty('--x', `${x}px`)
		cloud.style.setProperty('--y', `${y - geo.p.lift}px`)
	}

	const render = () => {
		const xf = geo.xOf(shown)
		clipRect.setAttribute('width', shown > 0 ? xf.toFixed(2) : 0)
		pill.textContent = `${format(shown)} уп.`
		if (!busy) placeFish(home())
	}

	const finish = () => {
		if (reached) {
			step.classList.add('is-reached')
			cloud.classList.add('is-hidden')
		}
	}

	// Повороты и проплыв рыбки
	const turn = async (to) => {
		if (fishDir === to) return
		const from = fishDir
		await tween(220, easeInOut, (t, e) => {
			fishDir = from + (to - from) * e
			if (Math.abs(fishDir) < 0.08) fishDir = 0.08 * Math.sign(to)
			placeFish(fishX)
		})
		fishDir = to
	}

	const swimTo = async (x) => {
		const from = fishX
		const dist = Math.abs(x - from)
		if (dist < 1) return true
		await turn(x > from ? 1 : -1)
		const duration = clamp(dist * 3.2, 350, 2600)
		return tween(duration, easeInOut, (t, e) =>
			placeFish(from + (x - from) * e, Math.sin(t * Math.PI * 4) * 1.5 * geo.k)
		)
	}

	const outing = async (route) => {
		if (busy || !started || reached || motion.matches) return
		busy = true
		cloud.classList.add('is-hidden')
		fishOuter.classList.add('is-swimming')
		await route()
		if (!disposed) {
			await swimTo(home())
			await turn(1)
			fishOuter.classList.remove('is-swimming')
			cloud.classList.remove('is-hidden')
			busy = false
			render()
		}
	}

	const tour = () =>
		outing(async () => {
			const { x0, x1, k } = geo
			await swimTo(x1 - NOSE * k)
			await swimTo(x0 + NOSE * k)
		})

	const feed = (x, y) =>
		outing(async () => {
			const { p, wave, k, x0, x1 } = geo
			const fx = clamp(x, x0, x1)
			const bottom = wave(fx) - p.band / 2 - 3
			const startY = clamp(y, 4, bottom - 10)
			const pellets = [-7, 0, 6, -2, 9].map((ox, i) =>
				el(
					'circle',
					{
						class: 'contest-scale__food',
						cx: fx + ox * k,
						cy: startY - i * 5,
						r: 2.2 * Math.max(k, 0.8),
					},
					foodLayer
				)
			)
			const fall = tween(900, easeOut, (t, e) =>
				pellets.forEach((pellet, i) => {
					const y0 = startY - i * 5
					pellet.setAttribute('cy', (y0 + (bottom - i * 2 - y0) * e).toFixed(2))
					pellet.setAttribute(
						'cx',
						(fx + [-7, 0, 6, -2, 9][i] * k + Math.sin(t * 6 + i) * 2).toFixed(2)
					)
				})
			)
			const facing = fx > fishX ? 1 : -1
			await swimTo(fx - facing * NOSE * k)
			await fall
			for (const pellet of pellets) {
				pellet.style.opacity = '0'
				await tween(90, easeOut, () => {})
			}
			await tween(250, easeOut, () => {})
			pellets.forEach((pellet) => pellet.remove())
		})

	// Появление: рыбка доплывает до факта
	const start = async () => {
		if (started || disposed) return
		started = true
		if (motion.matches || target === 0) {
			shown = target
			render()
			finish()
			return
		}
		await tween(clamp(900 + (target / plan) * 900, 900, 1800), easeOut, (t, e) => {
			shown = target * e
			render()
		})
		shown = target
		render()
		finish()
	}

	// Клики: по рыбке — проплыв, над шкалой — корм
	const onClick = (event) => {
		if (event.target.closest('.contest-scale__fish-btn')) return tour()
		const box = scale.getBoundingClientRect()
		const x = event.clientX - box.left
		const y = event.clientY - box.top
		if (Math.abs(x - fishX) < 34 * geo.k && Math.abs(y - geo.wave(fishX)) < 26 * geo.k)
			return tour()
		if (y < geo.p.cy + geo.p.band) feed(x, y)
	}
	scale.addEventListener('click', onClick)

	// Ширина изменилась — перестроить, рыбка на место
	let lastWidth = 0
	const resize = new ResizeObserver(() => {
		const width = scale.clientWidth
		if (!width || Math.abs(width - lastWidth) < 1) return
		lastWidth = width
		frames.forEach(cancelAnimationFrame)
		frames.clear()
		const swimming = busy
		busy = false
		fishDir = 1
		build()
		if (started && shown < target && !motion.matches) shown = target
		render()
		if (started) finish()
		if (swimming) fishOuter.classList.remove('is-swimming')
	})

	renderSummary()
	build()
	lastWidth = scale.clientWidth
	render()
	resize.observe(scale)

	return {
		el: step,
		start,
		dispose() {
			disposed = true
			frames.forEach(cancelAnimationFrame)
			frames.clear()
			resize.disconnect()
			scale.removeEventListener('click', onClick)
		},
	}
}

export default function init(root) {
	const timers = new Set()
	const steps = [...root.querySelectorAll('[data-contest-step]')].map((step, i) =>
		createStep(step, i)
	)

	// Шаги «оживают», когда видны; второй — чуть позже первого
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue
				observer.unobserve(entry.target)
				const i = steps.findIndex((s) => s.el === entry.target)
				const timer = setTimeout(() => {
					timers.delete(timer)
					steps[i]?.start()
				}, i * 250)
				timers.add(timer)
			}
		},
		{ threshold: 0.35 }
	)
	steps.forEach((s) => s.el && observer.observe(s.el))

	return () => {
		observer.disconnect()
		timers.forEach(clearTimeout)
		timers.clear()
		steps.forEach((s) => s.dispose())
	}
}

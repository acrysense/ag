import { getSwiper } from '@/utils/swiper'
import { lockBody } from '@/utils/scroll-lock'

let root, mainEl, thumbsEl, prevEl, nextEl, pagEl, overlayEl, closeBtns
let main,
	thumbs,
	items = [],
	lastActive = null
let releaseScroll = null
let mountToken = 0
const mql = window.matchMedia('(max-width:743px)')

const focusTrap = (e) => {
	if (e.key !== 'Tab') return
	const focusables = root.querySelectorAll(
		'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
	)
	if (!focusables.length) return
	const first = focusables[0],
		last = focusables[focusables.length - 1]
	if (e.shiftKey && document.activeElement === first) {
		e.preventDefault()
		last.focus()
	} else if (!e.shiftKey && document.activeElement === last) {
		e.preventDefault()
		first.focus()
	}
}

const keyHandler = (e) => {
	if (e.key === 'Escape') close()
}

const buildSlides = () => {
	const mw = mainEl.querySelector('.swiper-wrapper')
	const tw = thumbsEl.querySelector('.swiper-wrapper')
	mw.innerHTML = ''
	tw.innerHTML = ''
	items.forEach((it) => {
		const s1 = document.createElement('div')
		s1.className = 'swiper-slide'
		s1.innerHTML = `<picture class="pv__img"><img src="${it.src}" alt="${it.alt || ''}" loading="lazy"></picture>`
		mw.appendChild(s1)
		const s2 = document.createElement('div')
		s2.className = 'swiper-slide'
		s2.innerHTML = `<picture class="pv__thumb"><img src="${it.thumb || it.src}" alt=""></picture>`
		tw.appendChild(s2)
	})
}

const destroy = () => {
	if (main) {
		main.destroy(true, true)
		main = null
	}
	if (thumbs) {
		thumbs.destroy(true, true)
		thumbs = null
	}
}

const mount = async (startIndex = 0) => {
	const token = ++mountToken
	destroy()
	const { Swiper, mods } = await getSwiper()
	if (token !== mountToken || !root) return false
	const { Navigation, Thumbs, FreeMode, Keyboard, Pagination, A11y } = mods

	if (mql.matches) {
		thumbs = new Swiper(thumbsEl, {
			modules: [FreeMode, A11y],
			direction: 'horizontal',
			slidesPerView: 'auto',
			spaceBetween: 5,
			freeMode: true,
			watchSlidesProgress: true,
			a11y: { enabled: true },
		})
		main = new Swiper(mainEl, {
			modules: [Thumbs, Navigation, Keyboard, Pagination, A11y],
			initialSlide: startIndex,
			slidesPerView: 1,
			spaceBetween: 0,
			thumbs: { swiper: thumbs },
			navigation: { prevEl, nextEl },
			pagination: { el: pagEl, clickable: true },
			keyboard: { enabled: true },
			a11y: { enabled: true },
		})
	} else {
		thumbs = new Swiper(thumbsEl, {
			modules: [FreeMode, A11y],
			direction: 'vertical',
			slidesPerView: 'auto',
			spaceBetween: 5,
			freeMode: true,
			watchSlidesProgress: true,
			a11y: { enabled: true },
		})
		main = new Swiper(mainEl, {
			modules: [Thumbs, Navigation, Keyboard, A11y],
			initialSlide: startIndex,
			slidesPerView: 1,
			spaceBetween: 0,
			thumbs: { swiper: thumbs },
			navigation: { prevEl, nextEl },
			keyboard: { enabled: true },
			a11y: { enabled: true },
		})
	}
	return true
}

export const open = async (arr, startIndex = 0) => {
	if (!root) init()
	items = arr.slice()
	buildSlides()
	if (!(await mount(startIndex))) return
	lastActive = document.activeElement
	root.hidden = false
	releaseScroll ||= lockBody()
	root.addEventListener('keydown', focusTrap)
	window.addEventListener('keydown', keyHandler)
	root.querySelector('.pv__close')?.focus()
}

export const close = () => {
	if (!root || root.hidden) return
	root.hidden = true
	releaseScroll?.()
	releaseScroll = null
	root.removeEventListener('keydown', focusTrap)
	window.removeEventListener('keydown', keyHandler)
	mountToken += 1
	destroy()
	if (lastActive && typeof lastActive.focus === 'function') lastActive.focus()
}

export const init = () => {
	if (root) return
	root = document.getElementById('photo-viewer')
	if (!root) return
	mainEl = root.querySelector('.pv__main')
	thumbsEl = root.querySelector('.pv__thumbs')
	prevEl = root.querySelector('.pv__nav--prev')
	nextEl = root.querySelector('.pv__nav--next')
	pagEl = root.querySelector('.pv__pagination')
	overlayEl = root.querySelector('[data-pv-close]')
	closeBtns = root.querySelectorAll('[data-pv-close]')

	overlayEl?.addEventListener('click', close)
	closeBtns.forEach((b) => b.addEventListener('click', close))
	mql.addEventListener('change', onMediaChange)
}

const onMediaChange = () => {
	if (root && !root.hidden) {
		mount(main?.activeIndex || 0)
	}
}

export const bindLightbox = (galleryRoot) => {
	init()
	const imgs = galleryRoot.querySelectorAll('.gallery__main .gallery__img img')
	if (!imgs.length) return
	const sources = Array.from(imgs).map((img) => ({
		src: img.currentSrc || img.src,
		thumb: img.dataset.thumb || img.src,
		alt: img.alt || '',
	}))
	const bindings = Array.from(imgs).map((img, i) => {
		const cursor = img.style.cursor
		img.style.cursor = 'zoom-in'
		const onClick = (e) => {
			e.preventDefault()
			open(sources, i)
		}
		img.addEventListener('click', onClick)
		return { img, onClick, cursor }
	})

	return () => {
		bindings.forEach(({ img, onClick, cursor }) => {
			img.removeEventListener('click', onClick)
			img.style.cursor = cursor
		})
	}
}

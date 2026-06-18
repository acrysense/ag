import { getSwiper } from '@/utils/swiper'
import { bindLightbox, init as initPV } from '@/components/components/PhotoViewer/PhotoViewer'

export default async (root) => {
	if (!root || root.__galleryBound) return
	root.__galleryBound = true

	const block = root.querySelector('.news-inner__gallery')
	if (!block) return

	const mainEl = block.querySelector('.gallery__main')
	const thumbsEl = block.querySelector('.gallery__thumbs')
	const prevEl = block.querySelector('.gallery__nav--prev')
	const nextEl = block.querySelector('.gallery__nav--next')

	const { Swiper, mods } = await getSwiper()
	const { Navigation, Thumbs, FreeMode, Keyboard, A11y } = mods

	const mobileMax = parseInt(block.dataset.mobileMax || '743', 10)
	const mql = window.matchMedia(`(max-width:${mobileMax}px)`)

	let main, thumbs
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

	const mountMobile = () => {
		destroy()
		thumbsEl?.classList.add('is-hidden')

		main = new Swiper(mainEl, {
			modules: [Navigation, Keyboard, A11y],
			slidesPerView: 1,
			spaceBetween: 0,
			navigation: prevEl && nextEl ? { prevEl, nextEl } : undefined,
			keyboard: { enabled: true },
			a11y: { enabled: true },
			on: {
				init() {
					mainEl.dataset.swiperInited = '1'
				},
			},
		})
	}

	const mountDesktop = () => {
		destroy()
		thumbsEl?.classList.remove('is-hidden')

		if (thumbsEl) {
			thumbs = new Swiper(thumbsEl, {
				modules: [FreeMode],
				slidesPerView: 'auto',
				spaceBetween: 5,
				freeMode: true,
				watchSlidesProgress: true,
			})
		}

		main = new Swiper(mainEl, {
			modules: [Navigation, Thumbs, Keyboard, A11y],
			slidesPerView: 1,
			spaceBetween: 0,
			navigation: prevEl && nextEl ? { prevEl, nextEl } : undefined,
			thumbs: thumbs ? { swiper: thumbs } : undefined,
			keyboard: { enabled: true },
			a11y: { enabled: true },
		})
	}

	const slidesCount = mainEl?.querySelectorAll('.swiper-slide').length || 0
	const apply = () => {
		if (slidesCount <= 1) {
			prevEl?.setAttribute('hidden', '')
			nextEl?.setAttribute('hidden', '')
			thumbsEl?.setAttribute('hidden', '')
			destroy()
			return
		}
		mql.matches ? mountMobile() : mountDesktop()
	}

	apply()
	mql.addEventListener?.('change', apply)

	let unbindLightbox = null

	const dispose = () => {
		mql.removeEventListener?.('change', apply)
		destroy()
		unbindLightbox?.()
	}

	initPV()
	const galleryView = root.querySelector('.news-inner__gallery')
	if (galleryView) unbindLightbox = bindLightbox(galleryView)

	return dispose
}

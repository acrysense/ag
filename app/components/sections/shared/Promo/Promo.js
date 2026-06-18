import { getSwiper } from '@/utils/swiper'

export default async (root) => {
	const blocks = root.querySelectorAll('.promo__slider')
	if (!blocks.length) return

	const { Swiper, mods } = await getSwiper()
	const { Navigation, Pagination, A11y } = mods

	const instances = []

	blocks.forEach((block) => {
		const el = block.querySelector('.swiper')
		if (!el || el.dataset.swiperInited === '1') return

		const prevEl = block.querySelector('[data-swiper-prev]')
		const nextEl = block.querySelector('[data-swiper-next]')
		const paginationEl = block.querySelector('[data-swiper-pagination]')

		const swiper = new Swiper(el, {
			modules: [Navigation, Pagination, A11y],
			slidesPerView: 1,
			spaceBetween: 0,
			loop: true,
			navigation: prevEl && nextEl ? { prevEl, nextEl } : undefined,
			pagination: paginationEl ? { el: paginationEl, clickable: true } : undefined,
			a11y: { enabled: true },
			on: {
				init() {
					el.dataset.swiperInited = '1'
				},
			},
		})
		instances.push({ el, swiper })
	})

	return () => {
		instances.forEach(({ el, swiper }) => {
			swiper.destroy(true, true)
			delete el.dataset.swiperInited
		})
	}
}

let _p;
export function getSwiper() {
    if (!_p) {
        _p = Promise.all([import('swiper'), import('swiper/modules')])
            .then(([{ default: Swiper }, mods]) => ({ Swiper, mods }));
    }
    return _p;
}
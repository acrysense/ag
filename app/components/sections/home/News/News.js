export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const wrap = root.querySelector('.news__wrapper');
	const loader = root.querySelector('.news__loader');
	const sentinel = root.querySelector('.news__sentinel');
	if (!wrap || !sentinel) return;

	const batch = parseInt(root.dataset.batch || '6', 10);
	const minLoader = parseInt(root.dataset.minLoader || '450', 10);
	const items = Array.from(wrap.querySelectorAll('.news-card'));
	let shown = Math.min(batch, items.length);
	let busy = false, done = false;

	for (let i = shown; i < items.length; i++) items[i].setAttribute('hidden', '');

	const showLoader = (on) => {
		if (!loader) return;
		loader.hidden = !on;
		loader.setAttribute('aria-busy', on ? 'true' : 'false');
	};

	const revealNext = async () => {
		if (busy || done) return;
		if (shown >= items.length) { done = true; return; }
		busy = true;
		showLoader(true);
		await new Promise(r => setTimeout(r, minLoader)); // фейковая задержка для визуала

		const next = Math.min(shown + batch, items.length);
		for (let i = shown; i < next; i++) {
			items[i].removeAttribute('hidden');
			items[i].classList.add('news__item--reveal');
		}
		shown = next;

		showLoader(false);
		busy = false;

		if (shown >= items.length) {
			done = true;
			sentinel.remove();
			observer.disconnect?.();
		}
	};

	const observer = new IntersectionObserver((entries) => {
		if (entries.some(e => e.isIntersecting)) revealNext();
	}, { root: null, rootMargin: '300px 0px', threshold: 0 });

	observer.observe(sentinel);

	// если карточек меньше партии — сразу отключаем
	if (items.length <= shown) {
		sentinel.remove();
		observer.disconnect?.();
		loader?.remove();
	}
};
export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const btn = root.querySelector('.top-notice__close');
	const key = root.dataset.key || 'global';
	const storeKey = `topNotice:${key}`;

	const setH = () => root.style.setProperty('--h', root.scrollHeight + 'px');

	const hide = () => {
		root.classList.add('is-hidden');
		root.setAttribute('aria-hidden', 'true');
		try { localStorage.setItem(storeKey, '1'); } catch {}
	};

	const show = () => {
		root.classList.remove('is-hidden');
		root.removeAttribute('aria-hidden');
		setH();
	};

	if (localStorage.getItem(storeKey) === '1') {
		root.classList.add('is-hidden');
		root.setAttribute('aria-hidden', 'true');
	} else {
		show();
	}

	btn?.addEventListener('click', (e) => { e.preventDefault(); hide(); });

	const ro = new ResizeObserver(() => setH());
	ro.observe(root);
	window.addEventListener('resize', setH, { passive: true });

	root.__dispose = () => {
		ro.disconnect();
		window.removeEventListener('resize', setH);
	};
};
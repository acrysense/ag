export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const wrap = root.querySelector('.news__wrapper');
	const loader = root.querySelector('.news__loader');
	const sentinel = root.querySelector('.news__sentinel');
	if (!wrap || !sentinel) return;

	const api = root.dataset.api || '/local/ajax/news_list.php';
	const ib  = root.dataset.iblock || '';
	const batch = parseInt(root.dataset.batch || '6', 10);

	let page = parseInt(root.dataset.page || '1', 10);
	let busy = false, done = false;

	const showLoader = (on) => {
		if (!loader) return;
		loader.hidden = !on;
		loader.setAttribute('aria-busy', on ? 'true' : 'false');
	};

	const fetchPage = async () => {
		const body = new URLSearchParams();
		body.set('page', String(page + 1));
		body.set('per', String(batch));
		if (ib) body.set('iblock', ib);
		body.set('sessid', (window.BX && BX.bitrix_sessid) ? BX.bitrix_sessid() : '');

		const r = await fetch(api, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
			credentials: 'same-origin',
			body: body.toString()
		});
		if (!r.ok) throw new Error('HTTP '+r.status);
		return r.json();
	};

	const revealNext = async () => {
		if (busy || done) return;
		busy = true;
		showLoader(true);
		try {
			const data = await fetchPage();
			if (data?.html) {
				const tmp = document.createElement('div');
				tmp.innerHTML = data.html;
				const nodes = Array.from(tmp.children);
				nodes.forEach(n => {
					n.classList.add('news__item--reveal');
					wrap.appendChild(n);
				});
			}
			page += 1;
			if (!data?.hasMore) {
				done = true;
				sentinel.remove();
				observer.disconnect?.();
				loader?.remove();
			}
		} catch (e) {
			console.error(e);
		} finally {
			showLoader(false);
			busy = false;
		}
	};

	const observer = new IntersectionObserver((entries) => {
		if (entries.some(e => e.isIntersecting)) revealNext();
	}, { root: null, rootMargin: '300px 0px', threshold: 0 });

	observer.observe(sentinel);
};
export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const container = root.matches('.accordion') ? root : root.closest('.accordion') || root;
	const items = Array.from(container.querySelectorAll('.accordion__item'));
	const speed = parseInt(container.dataset.accSpeed || container.dataset.accSpeed || '250', 10);
	const single = container.dataset.accSingle === '1';

	const tidyTimer = new WeakMap();

	const closeItem = (item) => {
		if (!item.classList.contains('is-open')) return;
		const btn = item.querySelector('.accordion__toggle');
		const panel = item.querySelector('.accordion__panel');
		if (!btn || !panel) return;

		clearTimeout(tidyTimer.get(item));
		const h = panel.scrollHeight;
		panel.hidden = false;
		panel.style.height = h + 'px';
		requestAnimationFrame(() => {
			panel.style.height = '0px';
		});
		btn.setAttribute('aria-expanded', 'false');
		item.classList.remove('is-open');

		const t = setTimeout(() => {
			panel.hidden = true;
		}, speed + 30);
		tidyTimer.set(item, t);
	};

	const openItem = (item) => {
		if (item.classList.contains('is-open')) return;
		const btn = item.querySelector('.accordion__toggle');
		const panel = item.querySelector('.accordion__panel');
		if (!btn || !panel) return;

		if (single) items.forEach((it) => it !== item && closeItem(it));

		clearTimeout(tidyTimer.get(item));
		panel.hidden = false;
		panel.style.height = 'auto';
		const h = panel.scrollHeight;
		panel.style.height = '0px';
		requestAnimationFrame(() => {
			panel.style.height = h + 'px';
		});
		btn.setAttribute('aria-expanded', 'true');
		item.classList.add('is-open');

		const t = setTimeout(() => {
			panel.style.height = 'auto';
		}, speed + 30);
		tidyTimer.set(item, t);
	};

	items.forEach((item, idx) => {
		const btn = item.querySelector('.accordion__toggle');
		const panel = item.querySelector('.accordion__panel');
		if (!btn || !panel) return;

		const id = panel.id || `acc-${idx}-${Math.random().toString(36).slice(2,7)}`;
		panel.id = id;
		btn.setAttribute('aria-controls', id);
		btn.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');

		if (!item.classList.contains('is-open')) {
			panel.hidden = true;
			panel.style.height = '0px';
		} else {
			panel.hidden = false;
			panel.style.height = 'auto';
		}

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			item.classList.contains('is-open') ? closeItem(item) : openItem(item);
		});
	});

	container.addEventListener('accordion:open', (e) => {
		const sel = e.detail?.selector;
		const it = sel ? container.querySelector(sel) : null;
		if (it) openItem(it.closest('.accordion__item') || it);
	});

	container.addEventListener('accordion:close', (e) => {
		const sel = e.detail?.selector;
		const it = sel ? container.querySelector(sel) : null;
		if (it) closeItem(it.closest('.accordion__item') || it);
	});
};
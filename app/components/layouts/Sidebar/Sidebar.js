export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const wrap     = root.querySelector('.sidebar__wrap');
	const btnClose = root.querySelector('.sidebar__close');
	const docEl    = document.documentElement;
	const body     = document.body;

	const mql = window.matchMedia('(max-width: 743px)');
	const isMobile = () => mql.matches;

	let isOpen = false;
	let busy   = false;

	const lockScroll = (on) => {
		const v = on ? 'hidden' : '';
		docEl.style.overflow = v;
		body.style.overflow  = v;
	};

	const reflect = () => {
		const on = isOpen && isMobile();
		root.classList.toggle('is-open', on);
		root.setAttribute('aria-hidden', on ? 'false' : 'true');
		docEl.classList.toggle('sidebar-open', on);
		lockScroll(on);
	};

	const start = () => { busy = true;  root.dataset.sidebarBusy = '1'; };
	const end   = () => { busy = false; delete root.dataset.sidebarBusy; };

	const afterTransition = (cb) => {
		const d = parseFloat(getComputedStyle(wrap).transitionDuration || '0') * 1000;
		let done = false;
		const onEnd = () => { if (done) return; done = true; wrap.removeEventListener('transitionend', onEnd); cb(); };
		wrap.addEventListener('transitionend', onEnd, { once: true });
		if (d) setTimeout(onEnd, d + 50); else queueMicrotask(onEnd);
	};

	const returnFocusEl = () =>
		document.querySelector(root.dataset.returnFocus || '.header__hamburger') || null;

	const open = () => {
		if (busy || isOpen || !isMobile()) return;
		start();
		isOpen = true;
		reflect();
		(root.querySelector('.sidebar__link') || btnClose)?.focus?.({ preventScroll: true });
		afterTransition(end);
	};

	const close = () => {
		if (busy || !isOpen) return;
		start();
		returnFocusEl()?.focus?.({ preventScroll: true });
		isOpen = false;
		reflect();
		afterTransition(end);
	};

	const toggle = () => { if (!busy) (isOpen ? close() : open()); };

	root.addEventListener('click', (e) => {
		if (!isMobile() || !isOpen || busy) return;
		if (!wrap.contains(e.target)) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation?.();
			close();
		}
	}, true);

	btnClose?.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (isMobile()) close();
	});

	root.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isMobile() && isOpen && !busy) {
			e.preventDefault();
			close();
		}
	});

	const onOpen = () => open();
	const onClose = () => close();
	const onToggle = () => toggle();

	document.addEventListener('sidebar:open', onOpen);
	document.addEventListener('sidebar:close', onClose);
	document.addEventListener('sidebar:toggle', onToggle);

	const onResize = () => { if (!isMobile() && isOpen) { isOpen = false; reflect(); end(); } };
	window.addEventListener('resize', onResize, { passive: true });
	mql.addEventListener?.('change', onResize);

	isOpen = false;
	reflect();

	const norm = (p) => {
		try {
			const u = new URL(p, location.origin);
			let x = u.pathname.replace(/\/+$/,'');
			return x === '' ? '/' : x;
		} catch { return ''; }
	};

	const markActiveLinks = () => {
		const cur = norm(location.pathname);

		root.querySelectorAll('.sidebar__link').forEach(a => {
			a.classList.remove('is--active');
			a.closest('.sidebar__item')?.classList.remove('is--active');
			a.removeAttribute('aria-current');

			const href = a.getAttribute('href') || '';
			if (!href || href === '#' || /^https?:\/\//i.test(href)) return;

			const path  = norm(href);
			const exact = a.dataset.active === 'exact' || path === '/';

			const match = exact
				? cur === path
				: (cur === path || cur.startsWith(path + '/'));

			if (match) {
				a.classList.add('is--active');
				a.closest('.sidebar__item')?.classList.add('is--active');
				a.setAttribute('aria-current', 'page');
			}
		});
	};

	markActiveLinks();
	window.addEventListener('popstate', markActiveLinks);

	root.__dispose = () => {
		document.removeEventListener('sidebar:open', onOpen);
		document.removeEventListener('sidebar:close', onClose);
		document.removeEventListener('sidebar:toggle', onToggle);
		window.removeEventListener('resize', onResize);
		mql.removeEventListener?.('change', onResize);
		window.removeEventListener('popstate', markActiveLinks);
	};
};
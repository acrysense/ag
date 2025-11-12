export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const maxStack = 5;

	const escapeHtml = (s='') => s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

	const make = ({ type='success', text='', timeout=4000, id=null, role }={}) => {
		const el = document.createElement('div');
		el.className = `toast toast--${type}`;
		el.setAttribute('role', role || (type === 'error' ? 'alert' : 'status'));
		el.innerHTML = `
			<span class="toast__text">${escapeHtml(text)}</span>
			<button class="toast__close" aria-label="Закрыть">
				<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16"><use href="#icon-close"></use></svg>
			</button>
		`.trim();

		let timer = null;
		const close = () => {
			el.classList.remove('is-in');
			el.classList.add('is-out');
			el.addEventListener('transitionend', () => el.remove(), { once:true });
		};

		el.querySelector('.toast__close').addEventListener('click', close);

		el.addEventListener('mouseenter', () => { if (timer) { clearTimeout(timer); timer = null; } });
		el.addEventListener('mouseleave', () => { if (!timer && timeout) timer = setTimeout(close, timeout); });

		root.appendChild(el);
		requestAnimationFrame(() => el.classList.add('is-in'));

		if (timeout) timer = setTimeout(close, timeout);

		const items = root.querySelectorAll('.toast');
		if (items.length > maxStack) items[0].dispatchEvent(new Event('click'));

		return el;
	};

	const show = (opts) => make(typeof opts === 'string' ? { text: opts } : opts || {});
	const success = (text, opts={}) => show({ type:'success', text, ...opts });
	const error   = (text, opts={}) => show({ type:'error',   text, ...opts });

	document.addEventListener('toast:show', (e) => show(e.detail || {}));

	window.toast = { show, success, error };

	document.querySelectorAll('[data-toast][data-text]').forEach(n => {
		show({ type:n.dataset.type || 'success', text:n.dataset.text, timeout: parseInt(n.dataset.timeout||'4000',10) });
		n.remove();
	});
};
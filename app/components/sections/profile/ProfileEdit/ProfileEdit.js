export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const form       = root.closest('form') || root.querySelector('form');
	const newEl      = root.querySelector('#profile-password-new');
	const confirmEl  = root.querySelector('#profile-password-confirm');
	const saveBtn    = root.querySelector('.profile-edit__btn[type="submit"]');

	newEl?.removeAttribute('required');
	confirmEl?.removeAttribute('required');

	const minLen = (() => {
		const a = parseInt(newEl?.getAttribute('minlength') || '0', 10);
		return Number.isFinite(a) && a > 0 ? a : 6;
	})();

	const fieldOf = (el) => el?.closest('.field');
	const setErr = (el, msg) => {
		if (!el) return;
		const f = fieldOf(el);
		f?.classList.add('has-error');
		f?.classList.add('is--error');
		const err = f?.querySelector('.field__error');
		if (err) { err.textContent = msg; err.setAttribute('aria-hidden', 'false'); }
		el.setAttribute('aria-invalid', 'true');
	};
	const clrErr = (el) => {
		if (!el) return;
		const f = fieldOf(el);
		f?.classList.remove('has-error');
		f?.classList.remove('is--error');
		const err = f?.querySelector('.field__error');
		if (err) err.setAttribute('aria-hidden', 'true');
		el.removeAttribute('aria-invalid');
	};

	const validate = () => {
		let ok = true;
		const vNew = newEl?.value?.trim() ?? '';
		const vRep = confirmEl?.value?.trim() ?? '';

		if (!vNew && !vRep) {
			clrErr(newEl); clrErr(confirmEl);
			return true;
		}

		if (!vNew) { setErr(newEl, 'Введите новый пароль'); ok = false; }
		else if (vNew.length < minLen) { setErr(newEl, `Минимум ${minLen} символов`); ok = false; }
		else { clrErr(newEl); }

		if (!vRep) { setErr(confirmEl, 'Повторите новый пароль'); ok = false; }
		else if (vRep !== vNew) { setErr(confirmEl, 'Пароли не совпадают'); ok = false; }
		else { clrErr(confirmEl); }

		return ok;
	};

	const focusFirstError = () => {
		const el = root.querySelector('[aria-invalid="true"]');
		(fieldOf(el)?.querySelector('input,textarea,button'))?.focus?.({ preventScroll: true });
	};

	const live = () => validate();

	newEl?.addEventListener('input', live);
	confirmEl?.addEventListener('input', live);
	newEl?.addEventListener('blur', live);
	confirmEl?.addEventListener('blur', live);

	if (form) {
		form.setAttribute('novalidate', 'novalidate');
		form.addEventListener('submit', (e) => {
			if (!validate()) {
				e.preventDefault();
				focusFirstError();
			}
		});
	} else {
		saveBtn?.addEventListener('click', (e) => {
			if (!validate()) {
				e.preventDefault();
				focusFirstError();
			}
		});
	}

	clrErr(newEl); clrErr(confirmEl);
};
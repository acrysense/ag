import { applyMasks } from '@/utils/masks'

export default (root) => {
    const form = root.querySelector('.auth-form');
    if (!form || form.__bound) return;
    form.__bound = true;

    applyMasks(root);

    const btn = form.querySelector('button[type="submit"], .auth__btn');
    const formError = form.querySelector('[data-form-error]');

    const by = (name) => form.elements.namedItem(name);
    const fieldOf = (el) => el?.closest('.field');

    const setFieldError = (input, msg) => {
        const field = fieldOf(input);
        if (!field) return;
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        field.classList.toggle('is--error', !!msg);
        const m = field.querySelector('.field__error');
        if (m) { m.textContent = msg || ''; m.hidden = !msg; }
    };
    const setFormError = (msg) => {
        if (!formError) return;
        formError.textContent = msg || '';
        formError.hidden = !msg;
    };
    const setLoading = (on) => {
        if (!btn) return;
        btn.dataset.loading = on ? 'true' : 'false';
        btn.toggleAttribute('disabled', on);
        btn.setAttribute('aria-busy', on ? 'true' : 'false');
    };

    const validators = {
        login: (v) => v.trim().length >= 2 ? '' : 'Введите логин',
        password: (v) => v.trim().length >= 4 ? '' : 'Минимум 4 символа',
    };
    const validateOne = (name) => {
        const input = by(name); if (!input) return true;
        const rule = validators[name];
        const msg = rule ? rule(input.value)
                        : (input.validity.valid ? '' : input.validationMessage);
        setFieldError(input, msg);
        return !msg;
    };
    const watch = (input) => {
        if (!input) return;
        input.addEventListener('blur', () => validateOne(input.name));
        input.addEventListener('input', () => {
            if (fieldOf(input)?.classList.contains('is--error')) validateOne(input.name);
        });
    };
    watch(by('login')); watch(by('password'));

    const fetchAdapter = async (payload) => {
        const url = form.dataset.endpoint;
        const method = (form.dataset.method || 'POST').toUpperCase();
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'GET' ? undefined : JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));

        if (data?.errors && typeof data.errors === 'object') {
            Object.entries(data.errors).forEach(([k, v]) => setFieldError(by(k), String(v)));
        }
        if (!res.ok || data?.ok === false) {
            throw new Error(data?.error || `HTTP ${res.status}`);
        }
        return data;
    };

    const eventAdapter = async (payload) => {
        return new Promise((resolve, reject) => {
            const ev = new CustomEvent('auth:submit', {
                bubbles: true, cancelable: true,
                detail: { ...payload, resolve, reject }
            });
            const handled = root.dispatchEvent(ev) && ev.defaultPrevented;
            if (!handled) reject(new Error('__NO_HANDLER__'));
        });
    };

    const fakeAdapter = async (payload) => {
        const ms = Number(form.dataset.fakeDelay || 1500);
        await new Promise(r => setTimeout(r, ms));
        if (payload.login === 'demo' && payload.password === 'demo') return { ok: true };
        throw new Error('Логин и пароль не совпадают');
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFormError('');
        const ok = ['login', 'password'].every(validateOne);
        if (!ok) {
            form.querySelector('.field.is--error .field__input')?.focus();
            return;
        }

        setLoading(true);
            const payload = {
            login: by('login').value.trim(),
            password: by('password').value,
        };

        const adapters = [];
        if (form.dataset.endpoint) adapters.push(fetchAdapter);
        adapters.push(eventAdapter);
        if (form.dataset.demo === '1') adapters.push(fakeAdapter);

        let lastErr;
        for (const run of adapters) {
            try {
                await run(payload);
                location.assign(form.dataset.successHref || '/');
                setLoading(false);
                return;
            } catch (err) {
                if (String(err.message) === '__NO_HANDLER__') continue;
                lastErr = err;
            }
        }
        setFormError(lastErr?.message || 'Ошибка авторизации');
        setLoading(false);
    });
};
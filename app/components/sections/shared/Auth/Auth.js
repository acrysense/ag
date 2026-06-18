import { applyMasks } from '@/utils/masks'

export default (root) => {
	if (!root) return

	const form = root.querySelector('.auth-form')
	if (!form || form.__bound) return
	form.__bound = true

	const disposeMasks = applyMasks(root)
	let active = true
	let fakeTimer = null
	let resolveFakeDelay = null
	let requestController = null

	const fieldOf = (el) => el?.closest('.field')
	const setFieldError = (input, msg) => {
		if (!input) return
		const f = fieldOf(input)
		input.toggleAttribute('aria-invalid', !!msg)
		f?.classList.toggle('is--error', !!msg)
		const m = f?.querySelector('.field__error')
		if (m) {
			m.textContent = msg || ''
			m.hidden = !msg
		}
	}
	const setFormError = (msg) => {
		const n = form.querySelector('[data-form-error]')
		if (!n) return
		n.textContent = msg || ''
		n.hidden = !msg
	}
	const setLoading = (on) => {
		const btn = form.querySelector('button[type="submit"], .auth__btn, .auth-form__btn')
		if (!btn) return
		btn.dataset.loading = on ? 'true' : 'false'
		btn.toggleAttribute('disabled', on)
		btn.setAttribute('aria-busy', on ? 'true' : 'false')
	}

	const loginEl = form.querySelector('[name="login"],[name="USER_LOGIN"]')
	const passEl = form.querySelector('[name="password"],[name="USER_PASSWORD"]')

	const validateLogin = () => {
		const v = (loginEl?.value || '').trim()
		const msg = v.length >= 2 ? '' : 'Введите логин'
		setFieldError(loginEl, msg)
		return !msg
	}
	const validatePass = () => {
		const v = passEl?.value || ''
		const msg = v.trim().length >= 4 ? '' : 'Минимум 4 символа'
		setFieldError(passEl, msg)
		return !msg
	}
	const validateAll = () => {
		let ok = true
		if (loginEl && !validateLogin()) ok = false
		if (passEl && !validatePass()) ok = false
		return ok
	}

	const onLoginInput = () => fieldOf(loginEl)?.classList.contains('is--error') && validateLogin()
	const onPassInput = () => fieldOf(passEl)?.classList.contains('is--error') && validatePass()
	loginEl?.addEventListener('blur', validateLogin)
	passEl?.addEventListener('blur', validatePass)
	loginEl?.addEventListener('input', onLoginInput)
	passEl?.addEventListener('input', onPassInput)

	const fetchAdapter = async (payload) => {
		requestController?.abort()
		requestController = new AbortController()
		const url = form.dataset.endpoint
		const method = (form.dataset.method || 'POST').toUpperCase()
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: method === 'GET' ? undefined : JSON.stringify(payload),
			credentials: 'same-origin',
			signal: requestController.signal,
		})
		const data = await res.json().catch(() => ({}))

		if (data?.errors && typeof data.errors === 'object') {
			if (loginEl && data.errors.login) setFieldError(loginEl, String(data.errors.login))
			if (passEl && data.errors.password) setFieldError(passEl, String(data.errors.password))
		}
		if (!res.ok || data?.ok === false) {
			throw new Error(data?.error || `HTTP ${res.status}`)
		}
		return data
	}

	const fakeAdapter = async (payload) => {
		const ms = Number(form.dataset.fakeDelay || 1200)
		await new Promise((resolve) => {
			resolveFakeDelay = resolve
			fakeTimer = setTimeout(() => {
				resolveFakeDelay = null
				resolve()
			}, ms)
		})
		fakeTimer = null
		if (!active) return null
		if (payload.login === 'demo' && payload.password === 'demo') return { ok: true }
		throw new Error('Неверный логин или пароль')
	}

	const onSubmit = async (e) => {
		setFormError('')

		if (!validateAll()) {
			e.preventDefault()
			;(loginEl || passEl)?.focus?.({ preventScroll: true })
			return
		}

		const useAjax = !!form.dataset.endpoint || form.dataset.demo === '1'

		if (!useAjax) {
			return
		}

		e.preventDefault()
		setLoading(true)

		const payload = {
			login: (loginEl?.value || '').trim(),
			password: passEl?.value || '',
		}

		try {
			const adapters = []
			if (form.dataset.endpoint) adapters.push(fetchAdapter)
			if (form.dataset.demo === '1') adapters.push(fakeAdapter)

			let data
			for (const run of adapters) {
				data = await run(payload)
				break
			}
			if (!active || !data) return

			const goto = (data && data.redirect) || form.dataset.successHref || '/'
			location.assign(goto)
		} catch (err) {
			if (!active || err?.name === 'AbortError') return
			setFormError(err?.message || 'Ошибка авторизации')
		} finally {
			if (active) setLoading(false)
		}
	}

	form.addEventListener('submit', onSubmit)

	return () => {
		active = false
		clearTimeout(fakeTimer)
		resolveFakeDelay?.()
		resolveFakeDelay = null
		requestController?.abort()
		loginEl?.removeEventListener('blur', validateLogin)
		passEl?.removeEventListener('blur', validatePass)
		loginEl?.removeEventListener('input', onLoginInput)
		passEl?.removeEventListener('input', onPassInput)
		form.removeEventListener('submit', onSubmit)
		disposeMasks?.()
		delete form.__bound
	}
}

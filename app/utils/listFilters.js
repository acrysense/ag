// Фильтры списков ЛК из поиска в шапке (как на ag-site: layouts/SiteSearch). Разделы CRM поиска
// («Аптеки», «Менеджеры», «Сотрудники аптек», «Визиты», «Задачи») ведут на страницы списков с
// фильтрами в адресе; раздел этой же страницы поиск отдаёт событием site-search:apply — фильтры
// применяются на месте, без перезагрузки. Применяет их к таблице, календарю визитов или задачам
// в том же виде, что старая панель фильтров (components/HeaderSearch): { query, filters:
// [{ key, value, label, range? }] }, и рисует плашки над списком ([data-filter-chips]).
//
// Работает только с новой шапкой (.header--site) и только если на странице есть список; со
// старой шапкой фильтрами занимается HeaderSearch — бэку ничего не нужно.
//
// Адрес: q — запрос; key[] — несколько вариантов; key — один вариант или одно число;
// key_from / key_to — диапазон (числа как есть, даты YYYY-MM-DD → дд.мм.гггг); section — раздел.
// Таблица ЛК (utils/tableUrl) пишет адрес по-своему (key=значение, диапазон — «от|до»): при
// открытии он приводится к виду поиска, поля поиска в шапке выставляются по адресу.

const isoToDmy = (iso) => {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso))
	return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '')
}

const dmyToIso = (dmy) => {
	const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(dmy))
	return m ? `${m[3]}-${m[2]}-${m[1]}` : String(dmy || '')
}

const esc = (s) =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function initListFilters() {
	const header = document.querySelector('.header--site')
	const form = header?.querySelector('.site-search__form')
	if (!form || document.querySelector('[data-module="HeaderSearch"]')) return () => {}

	const tables = [...document.querySelectorAll('[data-data-table]')]
	const hasList = () =>
		tables.length > 0 ||
		document.querySelector('[data-module="VisitsCalendar"]') ||
		document.querySelector('.tasks-list')
	if (!hasList()) return () => {}

	const controller = new AbortController()
	const { signal } = controller
	const chipsHost = document.querySelector('[data-filter-chips]')
	const chipsList = chipsHost?.querySelector('[data-filter-chips-list]')
	const resetAllBtn = chipsHost?.querySelector('[data-filter-reset-all]')

	const control = (name) => form.querySelector(`[name="${CSS.escape(name)}"]`)

	// Адрес таблицы (key=значение, «от|до») → вид поиска (key[], key_from / key_to)
	const normalize = (source) => {
		const out = new URLSearchParams()
		for (const [name, value] of source.entries()) {
			if (name === 'q' || name === 'section' || control(name) || !value) {
				if (value) out.append(name, value)
			} else if (control(`${name}[]`)) out.append(`${name}[]`, value)
			else if (value.includes('|') && control(`${name}_from`)) {
				const [from, to] = value.split('|')
				const isDate = control(`${name}_from`).type === 'date'
				if (from) out.append(`${name}_from`, isDate ? dmyToIso(from) : from)
				if (to) out.append(`${name}_to`, isDate ? dmyToIso(to) : to)
			} else out.append(name, value)
		}
		return out
	}

	// Поля поиска в шапке — по адресу: открыв поиск, видно, что выбрано
	const syncForm = () => {
		form.querySelectorAll('.site-search__filter-list [name]').forEach((el) => {
			const values = params.getAll(el.name)
			if (el instanceof HTMLSelectElement) {
				;[...el.options].forEach((o) => (o.selected = values.includes(o.value)))
				if (!el.multiple && !values.length) el.value = ''
			} else el.value = values[0] || ''
			el.dispatchEvent(new Event('change', { bubbles: true }))
		})
		const input = form.querySelector('[name="q"]')
		if (input && params.get('q')) input.value = params.get('q')
	}

	let params = normalize(new URLSearchParams(window.location.search))

	// Подпись плашки: текст варианта из поля поиска (у «Аптеки» — полное название), иначе значение
	const optionText = (name, value) => {
		const select = form.querySelector(`select[name="${CSS.escape(name)}"]`)
		const option = select && [...select.options].find((o) => o.value === value)
		return option ? option.textContent.trim() : value
	}
	const placeholderOf = (name) =>
		form.querySelector(`[name="${CSS.escape(name)}"]`)?.closest('.date-range')?.dataset.placeholder ||
		form.querySelector(`[name="${CSS.escape(name)}"]`)?.getAttribute('placeholder') ||
		''

	const toFilters = () => {
		const filters = []
		const ranges = new Map()
		for (const [name, raw] of params.entries()) {
			const value = raw.trim()
			if (!value || name === 'q' || name === 'section') continue
			// Только поля поиска: служебные параметры (сортировка и страница таблицы, nav демо)
			// остаются в адресе, но фильтрами не считаются
			if (!control(name)) continue
			const range = /^(.+)_(from|to)$/.exec(name)
			if (range) {
				const r = ranges.get(range[1]) || { from: '', to: '', names: [] }
				r[range[2]] = value
				r.names.push(name)
				ranges.set(range[1], r)
				continue
			}
			const key = name.replace(/\[\]$/, '')
			const text = optionText(name, value)
			const isNumber = !form.querySelector(`select[name="${CSS.escape(name)}"]`)
			filters.push({ key, value, label: isNumber ? `${placeholderOf(name)}: ${value}` : text, names: [[name, raw]] })
		}
		ranges.forEach((r, key) => {
			const isDate = /^\d{4}-\d{2}-\d{2}$/.test(r.from || r.to)
			const from = isDate ? isoToDmy(r.from || r.to) : r.from
			const to = isDate ? isoToDmy(r.to || r.from) : r.to
			const title = placeholderOf(r.names[0]).replace(/\s+от$/, '')
			const label = isDate
				? `${title}: ${from === to ? from : `${from} – ${to}`}`
				: `${title}: ${from || '…'} – ${to || '…'}`
			filters.push({ key, value: `${from}|${to}`, range: { from, to }, label, names: r.names.map((n) => [n, params.get(n)]) })
		})
		return filters
	}

	const apply = () => {
		const filters = toFilters()
		const payload = { query: params.get('q') || '', filters }
		const tableApis = tables.map((t) => t.__dataTable).filter(Boolean)
		const calendars = [...document.querySelectorAll('[data-module="VisitsCalendar"]')]
			.map((c) => c.__visitsCalendar)
			.filter(Boolean)
		tableApis.forEach((api) => api.applyFilters(payload))
		calendars.forEach((api) => api.applyFilters(payload))
		if (!tableApis.length && !calendars.length) applyTaskFilter(payload)
		renderChips(filters)
	}

	// Страница задач — без таблицы: строки фильтруются на месте (как в HeaderSearch)
	const parseDmy = (s) => {
		const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s))
		return m ? new Date(+m[3], +m[2] - 1, +m[1]).setHours(0, 0, 0, 0) : null
	}
	const applyTaskFilter = ({ query, filters }) => {
		const lists = document.querySelectorAll('.tasks-list')
		const q = query.trim().toLowerCase()
		const of = (key) => filters.filter((f) => f.key === key).map((f) => f.value.toLowerCase())
		const assignees = of('assignee')
		const managers = of('manager')
		const pharmacies = of('pharmacy')
		const date = filters.find((f) => f.key === 'date' && f.range)
		const from = date ? parseDmy(date.range.from) : null
		const to = date ? parseDmy(date.range.to) : null
		const active = !!q || assignees.length > 0 || managers.length > 0 || pharmacies.length > 0 || from != null
		lists.forEach((ul) => {
			const rows = [...ul.querySelectorAll('.task-row')]
			rows.forEach((row) => {
				const who = (row.querySelector('.task-row__assignee')?.textContent || '').toLowerCase()
				const mgr = (row.dataset.manager || '').toLowerCase()
				const pharm = (row.dataset.pharmacy || '').toLowerCase()
				const when = parseDmy(row.querySelector('.task-row__date')?.textContent || '')
				let ok = true
				if (q && !row.textContent.toLowerCase().includes(q)) ok = false
				if (ok && assignees.length && !assignees.some((a) => who.includes(a))) ok = false
				if (ok && managers.length && !managers.some((m) => mgr.includes(m))) ok = false
				if (ok && pharmacies.length && !pharmacies.some((p) => pharm.includes(p))) ok = false
				if (ok && from != null && to != null && (when == null || when < from || when > to)) ok = false
				row.classList.toggle('is-filtered-out', !ok)
			})
			const anyVisible = rows.some((r) => !r.classList.contains('is-filtered-out') && !r.classList.contains('is-hidden'))
			const emptyByFilter = active && !anyVisible
			let empty = ul.querySelector('.tasks-list__empty--filter')
			if (emptyByFilter && !empty) {
				empty = document.createElement('li')
				empty.className = 'tasks-list__empty tasks-list__empty--filter'
				empty.textContent = 'Задачи по фильтру не найдены'
				ul.appendChild(empty)
			}
			if (empty) empty.hidden = !emptyByFilter
			ul.closest('.tasks-panel')?.querySelector('[data-tasks-toggle]')?.classList.toggle('is-filter-hidden', emptyByFilter)
		})
	}

	let current = []
	const renderChips = (filters) => {
		current = filters
		if (!chipsHost || !chipsList) return
		chipsList.textContent = ''
		filters.forEach((f, i) => {
			const chip = document.createElement('button')
			chip.type = 'button'
			chip.className = 'filter-chip'
			chip.dataset.index = String(i)
			chip.setAttribute('aria-label', `Убрать фильтр: ${f.label}`)
			chip.innerHTML = `<span>${esc(f.label)}</span><svg aria-hidden="true" focusable="false" width="10" height="10"><use href="#icon-close-thin"></use></svg>`
			chipsList.appendChild(chip)
		})
		chipsHost.hidden = filters.length === 0
	}

	// Поле поиска — в то же состояние, что адрес (после снятия плашки или сброса)
	const clearField = (name, value) => {
		const control = form.querySelector(`[name="${CSS.escape(name)}"]`)
		if (!control) return
		if (control instanceof HTMLSelectElement) {
			;[...control.options].forEach((o) => {
				if (o.value === value || (!control.multiple && o.value !== '')) o.selected = false
			})
			if (!control.multiple) control.value = ''
			control.dispatchEvent(new Event('change', { bubbles: true }))
		} else {
			control.value = ''
			control.dispatchEvent(new Event('change', { bubbles: true }))
			control.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	const writeUrl = () => {
		const qs = params.toString()
		history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
	}

	const removeFilter = (filter) => {
		filter.names.forEach(([name, value]) => {
			const rest = params.getAll(name).filter((v) => v !== value)
			params.delete(name)
			rest.forEach((v) => params.append(name, v))
			clearField(name, value)
		})
		writeUrl()
		apply()
	}

	chipsList?.addEventListener(
		'click',
		(event) => {
			const chip = event.target.closest('.filter-chip')
			if (chip) removeFilter(current[+chip.dataset.index])
		},
		{ signal }
	)
	resetAllBtn?.addEventListener(
		'click',
		() => {
			current.forEach((f) => f.names.forEach(([name, value]) => clearField(name, value)))
			const section = params.get('section')
			params = new URLSearchParams(section ? { section } : {})
			const input = form.querySelector('[name="q"]')
			if (input) input.value = ''
			writeUrl()
			apply()
		},
		{ signal }
	)

	// Поиск: раздел этой страницы — применить на месте (поиск ждёт отмену события)
	document.addEventListener(
		'site-search:apply',
		(event) => {
			event.preventDefault()
			params = new URLSearchParams(event.detail.params)
			writeUrl()
			apply()
		},
		{ signal }
	)

	// Таблица и календарь подключаются позже — применить, когда готовы
	document.addEventListener('datatable:ready', apply, { signal })
	document.addEventListener('visitscalendar:ready', apply, { signal })
	if (window.location.search) writeUrl()
	// Поля поиска подключаются вместе с шапкой — выставить, когда они готовы
	requestAnimationFrame(syncForm)
	apply()

	return () => controller.abort()
}

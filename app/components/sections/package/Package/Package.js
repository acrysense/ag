import { mountTabs } from '@/utils/tabs';

export default (root) => {
	if (!root || root.__motivationBound) return;
	root.__motivationBound = true;

	mountTabs(root);
	initProgress(root);
	initPackageBlocks(root);
};

function initProgress(root) {
	const els = root.querySelectorAll('.n-coefficient-progress__value');
	els.forEach((el) => {
		if (el.__animated) return;
		el.__animated = true;

		const raw = String(el.dataset.target || '0').replace(',', '.');
		const target = parseFloat(raw) || 0;
		const duration = 1000;
		const fmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

		let t0 = null;
		const step = (ts) => {
			if (!t0) t0 = ts;
			const p = Math.min((ts - t0) / duration, 1);
			el.textContent = `${fmt.format(target * p)}%`;
			if (p < 1) requestAnimationFrame(step);
			else el.textContent = `${fmt.format(target)}%`;
		};
		requestAnimationFrame(step);
	});
}

function initPackageBlocks(root) {
	const tables = root.querySelectorAll('.n-package-table');
	tables.forEach((table) => {
		const wrapper = table.closest('.package__wrapper') || table.parentElement || table;

		const tabs = wrapper.querySelectorAll('.n-package-filter__tab');
		const search = wrapper.querySelector('.n-package-filter__search-input');
		const body = table.querySelector('.n-package-table__body');
		const noResults	= table.querySelector('.n-package-table__no-results');
		if (!body) return;

		body.querySelectorAll('.n-package-table__value').forEach((cell) => {
			if (cell.dataset.original == null) cell.dataset.original = cell.innerHTML;
		});

		const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const parseWorkValue = (cell) => {
			if (!cell) return 0;
			const raw = String(cell.dataset.workValue || '').replace(',', '.');
			const n = parseFloat(raw);
			return isNaN(n) ? 0 : n;
		};

		let currentWorkFilter = 'all';
		let currentSearchTerm = '';

		const applyFilter = () => {
			let visible = 0;

			body.querySelectorAll('.n-package-table__value').forEach((cell) => {
				if (cell.dataset.original != null) cell.innerHTML = cell.dataset.original;
			});

			const regex = currentSearchTerm ? new RegExp(`(${escapeRegExp(currentSearchTerm)})`, 'gi') : null;
			const items = Array.from(body.children);

			for (let i = 0; i < items.length; i++) {
				const el = items[i];

				if (el.classList.contains('n-package-table__row') && !el.classList.contains('n-package-table__row-group')) {
					const parentRow = el;

					let group = null;
					if (i + 1 < items.length && items[i + 1].classList.contains('n-package-table__row-group')) {
						group = items[i + 1];
					}

					const workCell = parentRow.querySelector('[data-work-value]');
					const workValue = parseWorkValue(workCell);
					const passWorkParent = currentWorkFilter === 'all' || (currentWorkFilter === 'in-work' && workValue > 0);
					const passSearchParent = parentRow.textContent.toLowerCase().includes(currentSearchTerm);

					let passAnyChild = false;
					if (group) {
						const childRows = Array.from(group.querySelectorAll('.n-package-table__row'));
						childRows.forEach((child) => {
							const workCellC = child.querySelector('[data-work-value]');
							const workValueC = parseWorkValue(workCellC);
							const passWorkC = currentWorkFilter === 'all' || (currentWorkFilter === 'in-work' && workValueC > 0);
							const passSearchC = child.textContent.toLowerCase().includes(currentSearchTerm);
							const showChild = passWorkC && passSearchC;

							child.style.display = showChild ? '' : 'none';
							if (showChild) {
								passAnyChild = true;
								if (regex) {
									child.querySelectorAll('.n-package-table__value').forEach((cell) => {
										cell.innerHTML = cell.dataset.original.replace(regex, '<strong>$1</strong>');
									});
								}
							}
						});
					}

					const showParent = (passWorkParent && passSearchParent) || passAnyChild;
					parentRow.style.display = showParent ? '' : 'none';
					if (showParent) {
						visible++;
						if (regex && passSearchParent) {
							parentRow.querySelectorAll('.n-package-table__value').forEach((cell) => {
								cell.innerHTML = cell.dataset.original.replace(regex, '<strong>$1</strong>');
							});
						}
					}

					if (group) {
						group.style.display = passAnyChild ? '' : 'none';
						if (!passAnyChild) parentRow.classList.remove('is--active', 'is--open');
						i++;
					}
				}
				else if (el.classList.contains('n-package-table__row')) {
					const row = el;
					const workCell = row.querySelector('[data-work-value]');
					const workValue = parseWorkValue(workCell);
					const passWork = currentWorkFilter === 'all' || (currentWorkFilter === 'in-work' && workValue > 0);
					const passSearch = row.textContent.toLowerCase().includes(currentSearchTerm);

					const show = passWork && passSearch;
					row.style.display = show ? '' : 'none';
					if (show) {
						visible++;
						if (regex) {
							row.querySelectorAll('.n-package-table__value').forEach((cell) => {
								cell.innerHTML = cell.dataset.original.replace(regex, '<strong>$1</strong>');
							});
						}
					}
				}
			}

			if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
		};

		if (tabs.length) {
			tabs.forEach((tab) => {
				tab.addEventListener('click', () => {
					tabs.forEach((t) => t.classList.remove('is--active'));
					tab.classList.add('is--active');
					currentWorkFilter = tab.dataset.work || 'all';
					applyFilter();
				});
			});
		}

		if (search) {
			search.addEventListener('input', () => {
				currentSearchTerm = search.value.trim().toLowerCase();
				applyFilter();
			});
		}

		applyFilter();

		table.querySelectorAll('.n-package-table__trigger').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const parent = btn.closest('.n-package-table__row');
				const group = parent?.nextElementSibling;
				if (!group || !group.classList.contains('n-package-table__row-group')) return;
				parent.classList.toggle('is--active');
				group.classList.toggle('is--open');
			});
		});
	});
}
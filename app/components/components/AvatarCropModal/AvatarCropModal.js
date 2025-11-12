export function openAvatarCropModal(file) {
	return new Promise((resolve) => {
		if (!file) return resolve(null);

		const url = URL.createObjectURL(file);
		const root = document.createElement('div');
		root.className = 'avatar-crop-modal';
		root.innerHTML = `
			<div class="avatar-crop-modal__overlay"></div>
			<div class="avatar-crop-modal__content" role="dialog" aria-modal="true" aria-label="Кадрирование фото">
				<div class="avatar-crop-modal__top">
					<h3 class="avatar-crop-modal__title">Фотография профиля</h3>
					<button class="avatar-crop-modal__close" type="button" aria-label="Закрыть">
						<svg aria-hidden="true" focusable="false" width="20" height="20">
							<use href="#icon-close"></use>
						</svg>
					</button>
				</div>
				<div class="avatar-crop-modal__viewport">
					<img class="avatar-crop-modal__img" alt="">
					<div class="avatar-crop-modal__crop" tabindex="0" aria-label="Область кадрирования">
						<button class="avatar-crop-modal__handle" data-corner="nw" aria-label="Изменить размер"></button>
						<button class="avatar-crop-modal__handle" data-corner="ne" aria-label="Изменить размер"></button>
						<button class="avatar-crop-modal__handle" data-corner="se" aria-label="Изменить размер"></button>
						<button class="avatar-crop-modal__handle" data-corner="sw" aria-label="Изменить размер"></button>
					</div>
				</div>
				<div class="avatar-crop-modal__actions">
					<button class="btn avatar-crop-modal__action" type="button" data-save>Сохранить</button>
					<button class="btn btn--secondary avatar-crop-modal__action" type="button" data-cancel>Вернуться назад</button>
				</div>
			</div>
		`;

		const overlay = root.querySelector('.avatar-crop-modal__overlay');
		const btnSave = root.querySelector('[data-save]');
		const btnCancel = root.querySelector('[data-cancel]');
		const btnClose = root.querySelector('.avatar-crop-modal__close');

		const viewport = root.querySelector('.avatar-crop-modal__viewport');
		const img = root.querySelector('.avatar-crop-modal__img');
		const cropEl = root.querySelector('.avatar-crop-modal__crop');

		const prevFocus = document.activeElement;
		const prevOverflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';

		let iw = 0, ih = 0;
		let scale = 1, offX = 0, offY = 0;
		let vpW = 0, vpH = 0;

		const MIN = 64;

		const crop = { x: 0, y: 0, size: 0 };

		function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

		function layoutImage() {
			const r = viewport.getBoundingClientRect();
			vpW = r.width; vpH = r.height;

			scale = Math.max(vpW / iw, vpH / ih);
			const dispW = iw * scale;
			const dispH = ih * scale;
			offX = (vpW - dispW) / 2;
			offY = (vpH - dispH) / 2;

			img.style.width = `${dispW}px`;
			img.style.height = `${dispH}px`;
			img.style.transform = `translate(${offX}px, ${offY}px)`;

			const s = Math.min(vpW, vpH) * 0.8;
			crop.size = s;
			crop.x = (vpW - s) / 2;
			crop.y = (vpH - s) / 2;
			applyCrop();
		}

		function applyCrop() {
			cropEl.style.left = `${crop.x}px`;
			cropEl.style.top = `${crop.y}px`;
			cropEl.style.width = `${crop.size}px`;
			cropEl.style.height = `${crop.size}px`;
		}

		function toViewportPoint(e) {
			const r = viewport.getBoundingClientRect();
			return { x: e.clientX - r.left, y: e.clientY - r.top };
		}

		let dragMode = null;
		let corner = null;
		let start = { x: 0, y: 0 };
		let base = { x: 0, y: 0, size: 0 };

		function onPointerDown(e) {
			e.preventDefault();
			const handle = e.target.closest('.avatar-crop-modal__handle');
			if (handle) {
				dragMode = 'resize';
				corner = handle.dataset.corner;
			} else {
				dragMode = 'move';
			}
			start = toViewportPoint(e);
			base = { x: crop.x, y: crop.y, size: crop.size };
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp, { once: true });
		}

		function onPointerMove(e) {
			const p = toViewportPoint(e);

			if (dragMode === 'move') {
				let nx = base.x + (p.x - start.x);
				let ny = base.y + (p.y - start.y);
				nx = clamp(nx, 0, vpW - crop.size);
				ny = clamp(ny, 0, vpH - crop.size);
				crop.x = nx; crop.y = ny;
				applyCrop();
				return;
			}

			let s, x, y;

			if (corner === 'se') {
				const maxS = Math.min(vpW - base.x, vpH - base.y);
				s = clamp(Math.max(p.x - base.x, p.y - base.y), MIN, maxS);
				x = base.x; y = base.y;
			} else if (corner === 'nw') {
				const anchorX = base.x + base.size;
				const anchorY = base.y + base.size;
				const maxS = Math.min(anchorX, anchorY);
				s = clamp(Math.max(anchorX - p.x, anchorY - p.y), MIN, maxS);
				x = anchorX - s; y = anchorY - s;
			} else if (corner === 'ne') {
				const anchorX = base.x;
				const anchorY = base.y + base.size;
				const maxS = Math.min(vpW - anchorX, anchorY);
				s = clamp(Math.max(p.x - anchorX, anchorY - p.y), MIN, maxS);
				x = anchorX; y = anchorY - s;
			} else {
				const anchorX = base.x + base.size;
				const anchorY = base.y;
				const maxS = Math.min(anchorX, vpH - anchorY);
				s = clamp(Math.max(anchorX - p.x, p.y - anchorY), MIN, maxS);
				x = anchorX - s; y = anchorY;
			}

			x = clamp(x, 0, vpW - s);
			y = clamp(y, 0, vpH - s);
			crop.x = x; crop.y = y; crop.size = s;
			applyCrop();
		}

		function onPointerUp() {
			window.removeEventListener('pointermove', onPointerMove);
			dragMode = null; corner = null;
		}

		function doSave() {
			const out = 512;
			let sx = (crop.x - offX) / scale;
			let sy = (crop.y - offY) / scale;
			let sw = crop.size / scale;
			let sh = sw;

			if (sx < 0) { sw += sx; sx = 0; }
			if (sy < 0) { sh += sy; sy = 0; }
			if (sx + sw > iw) sw = iw - sx;
			if (sy + sh > ih) sh = ih - sy;

			const canvas = document.createElement('canvas');
			canvas.width = out; canvas.height = out;
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, out, out);
			canvas.toBlob((blob) => { cleanup(); resolve(blob); }, 'image/jpeg', 0.92);
		}

		function onKey(e) {
			if (e.key === 'Escape') cancel();
			if (e.key === 'Enter' || e.key === 'NumpadEnter') doSave();
		}

		function cancel() { cleanup(); resolve(null); }
		function cleanup() {
			document.documentElement.style.overflow = prevOverflow || '';
			URL.revokeObjectURL(url);
			root.remove();
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pointermove', onPointerMove);
			if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
		}

		document.body.appendChild(root);
		window.addEventListener('keydown', onKey);

		const imageEl = new Image();
		imageEl.onload = () => {
			iw = imageEl.naturalWidth; ih = imageEl.naturalHeight;
			img.src = url;
			layoutImage();
		};
		imageEl.src = url;

		cropEl.addEventListener('pointerdown', onPointerDown);
		cropEl.querySelectorAll('.avatar-crop-modal__handle').forEach(h =>
			h.addEventListener('pointerdown', onPointerDown)
		);

		btnSave.addEventListener('click', doSave);
		btnCancel.addEventListener('click', cancel);
		btnClose.addEventListener('click', cancel);
		overlay.addEventListener('click', cancel);
	});
}
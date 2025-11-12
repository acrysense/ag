import { openAvatarCropModal } from '@/components/components/AvatarCropModal/AvatarCropModal';

export default (root) => {
	if (!root || root.__bound) return;
	root.__bound = true;

	const input = root.querySelector('.avatar-uploader__input');
	const img = root.querySelector('.avatar-uploader__img');
	const btnChoose = root.querySelector('.avatar-uploader__choose');
	const btnRemove = root.querySelector('.avatar-uploader__remove');

	const placeholder = root.dataset.placeholder || '/assets/images/avatar-placeholder.jpg';
	const maxMb = parseFloat(root.dataset.maxMb || '5') || 5;
	const maxBytes = maxMb * 1024 * 1024;

	let currentURL = null;

	const hasValue = () => !!img.dataset.valueSrc;

	const reflect = () => {
		root.classList.toggle('has-value', hasValue());
		btnRemove.hidden = !hasValue();
		if (!hasValue()) {
			if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
			img.src = placeholder;
		}
	};

	const setBlobToInput = async (blob) => {
		const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
		const file = new File([blob], `avatar.${ext}`, { type: blob.type });
		const dt = new DataTransfer();
		dt.items.add(file);
		input.files = dt.files;
	};

	const applyPreview = (blob) => {
		if (currentURL) URL.revokeObjectURL(currentURL);
		currentURL = URL.createObjectURL(blob);
		img.src = currentURL;
		img.dataset.valueSrc = '1';
		reflect();
	};

	const onPick = async (file) => {
		if (!file) return;
		if (!/^image\//.test(file.type)) return;
		if (file.size > maxBytes) {
			alert(`Файл больше ${maxMb} МБ`);
			input.value = '';
			return;
		}
		const cropped = await openAvatarCropModal(file);
		if (!cropped) {
			input.value = '';
			return;
		}
		await setBlobToInput(cropped);
		applyPreview(cropped);
		root.dispatchEvent(new CustomEvent('avatar:change', { bubbles: true }));
	};

	btnChoose.addEventListener('click', (e) => {
		e.preventDefault();
		input.click();
	});

	input.addEventListener('change', () => {
		const file = input.files && input.files[0];
		onPick(file);
	});

	btnRemove.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		input.value = '';
		delete img.dataset.valueSrc;
		reflect();
		root.dispatchEvent(new CustomEvent('avatar:clear', { bubbles: true }));
	});

	if (!img.getAttribute('src')) img.src = placeholder;
	if (img.getAttribute('src') && img.getAttribute('src') !== placeholder) {
		img.dataset.valueSrc = '1';
	}
	reflect();
};
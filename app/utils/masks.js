import Inputmask from 'inputmask';

export function applyMasks(root = document) {
    const els = root.querySelectorAll('[data-mask]');
    if (!els.length) return;

    const common = {
        showMaskOnFocus: true,
        showMaskOnHover: false,
        rightAlign: false,
        clearIncomplete: false,
    };

    els.forEach((el) => {
        if (el.dataset.maskApplied === '1') return;

        const mask = el.getAttribute('data-mask');
        if (!mask) return;

        try {
            Inputmask({ mask, ...common }).mask(el);
            el.dataset.maskApplied = '1';
        } catch (e) {
            console.error('[masks] apply error', e);
        }
    });
}
export default (root) => {
    if (!root || root.__dropdownBound) return;
    root.__dropdownBound = true;

    const trigger = root.querySelector('.profile-dropdown__trigger');
    const panel = root.querySelector('.profile-dropdown__panel');
    const items = () => [...panel.querySelectorAll('.profile-dropdown__item')];

    const place = (placement = (root.dataset.placement || 'bottom-end')) => {
        root.style.position = 'relative';
        panel.style.position = 'absolute';
        panel.style.top = 'calc(100% + 8px)';
        panel.style.left = placement.includes('start') ? '0' : 'auto';
        panel.style.right = placement.includes('end') ? '0' : 'auto';
    };
    place();

    const open = () => {
        if (root.classList.contains('is-open')) return;
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.hidden = false;

        const it = items()[0];
        if (it) it.focus({ preventScroll: true });

        document.addEventListener('pointerdown', onDocDown, true);
        document.addEventListener('keydown', onDocKey, true);
        window.addEventListener('resize', close, { once: true });
        window.addEventListener('scroll', close, { once: true });
    };

    const close = () => {
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        panel.hidden = true;

        document.removeEventListener('pointerdown', onDocDown, true);
        document.removeEventListener('keydown', onDocKey, true);
    };

    const toggle = () => (root.classList.contains('is-open') ? close() : open());

    function onDocDown(e) {
        if (!root.contains(e.target)) close();
    }

    function onDocKey(e) {
        if (!root.classList.contains('is-open')) return;

        const list = items();
        const idx = list.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
        else if (e.key === 'ArrowDown') {
            e.preventDefault(); (list[idx + 1] || list[0])?.focus();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault(); (list[idx - 1] || list[list.length - 1])?.focus();
        }
        else if (e.key === 'Tab') {
            close();
        }
    }

    trigger.addEventListener('click', (e) => { e.preventDefault(); toggle(); });

    panel.addEventListener('click', (e) => {
        const item = e.target.closest('.profile-dropdown__item');
        if (!item) return;
        const action = item.dataset.action;
        if (action) {
            const ev = new CustomEvent('dropdown:select', { bubbles: true, detail: { action }});
            root.dispatchEvent(ev);
            if (ev.defaultPrevented) { e.preventDefault(); }
        }
        close();
    });
};
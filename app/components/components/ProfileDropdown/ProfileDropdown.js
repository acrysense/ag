export default (root) => {
    if (!root || root.__dropdownBound) return;
    root.__dropdownBound = true;

    const trigger = root.querySelector('.profile-dropdown__trigger');
    const panel   = root.querySelector('.profile-dropdown__panel');
    const wrap    = panel?.querySelector('.profile-dropdown__wrap');
    const closeBtn= panel?.querySelector('.profile-dropdown__close');
    if (!trigger || !panel || !wrap) return;

    const mql = window.matchMedia('(max-width: 743px)');
    const isMobile = () => mql.matches;

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');

    function place() {
        if (isMobile()) {
            panel.style.position = '';
            panel.style.top = panel.style.right = panel.style.left = panel.style.bottom = '';
            return;
        }
        const placement = String(root.dataset.placement || 'bottom-end');
        root.style.position = 'relative';
        panel.style.position = 'absolute';
        panel.style.top  = 'calc(100% + 8px)';
        panel.style.left  = placement.indexOf('start') !== -1 ? '0'  : 'auto';
        panel.style.right = placement.indexOf('end')   !== -1 ? '0'  : 'auto';
    }
    place();

    let busy = false;
    let openState = false;

    const getDurMs = () => {
        // берём макс из transition на панели (оверлей) и на wrap (сдвиг)
        const cp = getComputedStyle(panel);
        const cw = getComputedStyle(wrap);
        const p = (parseFloat(cp.transitionDuration) || 0) + (parseFloat(cp.transitionDelay) || 0);
        const w = (parseFloat(cw.transitionDuration) || 0) + (parseFloat(cw.transitionDelay) || 0);
        return Math.max(p, w) * 1000;
    };
    const begin = () => { busy = true; };
    const done  = () => { busy = false; };

    const onDocDown = (e) => {
        if (!isMobile() && !root.contains(e.target)) close();
    };
    const onDocKey  = (e) => {
        if (!openState) return;
        const items = [...panel.querySelectorAll('.profile-dropdown__item')];
        const idx = items.indexOf(document.activeElement);

        if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus({preventScroll:true}); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); (items[idx + 1] || items[0])?.focus(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); (items[idx - 1] || items[items.length - 1])?.focus(); }
        else if (e.key === 'Tab') { close(); }
    };

    function open() {
        if (openState || busy) return;
        begin();
        openState = true;

        panel.removeAttribute('inert');
        panel.setAttribute('aria-hidden', 'false');
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');

        const first = panel.querySelector('.profile-dropdown__item');
        first?.focus?.({ preventScroll: true });

        document.addEventListener('pointerdown', onDocDown, true);
        document.addEventListener('keydown', onDocKey, true);

        const onResize = () => { place(); };
        window.addEventListener('resize', onResize);
        open._onResize = onResize;

        setTimeout(done, getDurMs());
    }

    function close() {
        if (!openState) return;
        begin();
        openState = false;

        const hadFocusInside = panel.contains(document.activeElement);
        if (hadFocusInside) {
            trigger.focus({ preventScroll: true });
        }

        panel.setAttribute('inert', '');

        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');

        requestAnimationFrame(() => {
            panel.setAttribute('aria-hidden', 'true');
        });

        document.removeEventListener('pointerdown', onDocDown, true);
        document.removeEventListener('keydown', onDocKey, true);
        if (open._onResize) {
            window.removeEventListener('resize', open._onResize);
            open._onResize = null;
        }

        setTimeout(() => {
            panel.removeAttribute('inert');
            done();
        }, getDurMs());
    }

    const toggle = () => { if (!busy) (openState ? close() : open()); };

    trigger.addEventListener('click', (e) => { e.preventDefault(); toggle(); });

    panel.addEventListener('click', (e) => {
        const item = e.target.closest('.profile-dropdown__item');
        if (item) {
            const action = item.dataset.action;
            if (action) {
                const ev = new CustomEvent('dropdown:select', { bubbles: true, detail: { action } });
                root.dispatchEvent(ev);
                if (ev.defaultPrevented) e.preventDefault();
            }
            close();
            return;
        }

        if (isMobile() && !wrap.contains(e.target)) {
            e.preventDefault();
            close();
        }
    });

    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
    });

    mql.addEventListener?.('change', () => { close(); place(); });

    root.classList.remove('is-open');
};
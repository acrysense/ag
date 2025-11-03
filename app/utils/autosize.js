function getLineHeightPx(el) {
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight;
    if (lh.endsWith && lh.endsWith('px')) return parseFloat(lh);
    const n = parseFloat(lh);
    if (!Number.isNaN(n) && String(n) === lh.trim()) {
        const fs = parseFloat(cs.fontSize) || 16;
        return n * fs;
    }
    const probe = document.createElement('span');
    probe.textContent = 'M';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    probe.style.font = cs.font;
    const wrap = document.createElement('div');
    wrap.style.position = 'absolute'; wrap.style.left = '-9999px'; wrap.style.top = '0';
    const a = probe.cloneNode(true), b = probe.cloneNode(true);
    wrap.appendChild(a); wrap.appendChild(document.createElement('br')); wrap.appendChild(b);
    document.body.appendChild(wrap);
    const h = wrap.getBoundingClientRect().height;
    document.body.removeChild(wrap);
    return h / 2;
}

function getMaxHeight(el) {
    const attr = el.getAttribute('data-autosize-max-rows');
    if (!attr) return null;
    const rows = Math.max(1, parseInt(attr, 10));
    const cs = getComputedStyle(el);
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const lh = getLineHeightPx(el);
    const includeBorder = cs.boxSizing === 'border-box' ? border : 0;
    return Math.ceil(rows * lh + pad + includeBorder);
}

function resize(el) {
    const cs = getComputedStyle(el);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const isBorderBox = cs.boxSizing === 'border-box';

    el.style.height = 'auto';

    let target = el.scrollHeight;
    if (isBorderBox) target += border;

    const maxH = getMaxHeight(el);
    if (maxH) {
        const exceeds = target > maxH + 0.5;
        el.style.height = Math.min(Math.ceil(target), maxH) + 'px';
        el.style.overflowY = exceeds ? 'auto' : 'hidden';
    } else {
        el.style.height = Math.ceil(target) + 'px';
        el.style.overflowY = 'hidden';
    }
}

function nextValueAfterBeforeInput(el, e) {
    const t = el.value;
    const start = el.selectionStart ?? t.length;
    const end   = el.selectionEnd   ?? t.length;
    const data = (e.data == null) ? '' : e.data;

    switch (e.inputType) {
        case 'insertText':
        case 'insertCompositionText': return t.slice(0, start) + data + t.slice(end);
        case 'insertParagraph':
        case 'insertLineBreak': return t.slice(0, start) + '\n' + t.slice(end);
        case 'insertFromPaste':
        case 'insertFromDrop': {
            const clip = (e.clipboardData && e.clipboardData.getData('text')) || data;
            return t.slice(0, start) + clip + t.slice(end);
        }
        case 'deleteContentBackward':
            if (start === end && start > 0) return t.slice(0, start - 1) + t.slice(end);
            return t.slice(0, start) + t.slice(end);
        case 'deleteContentForward':
            if (start === end && end < t.length) return t.slice(0, start) + t.slice(end + 1);
            return t.slice(0, start) + t.slice(end);
        default:
            return t.slice(0, start) + data + t.slice(end);
    }
}

function wouldExceed(el, candidateValue, maxH) {
    const cs = getComputedStyle(el);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const isBorderBox = cs.boxSizing === 'border-box';

    let clone = el._autosizeClone;

    if (!clone) {
        clone = el._autosizeClone = el.cloneNode();
        clone.style.visibility = 'hidden';
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '0';
        clone.style.height = 'auto';
        clone.style.minHeight = '0';
        clone.style.maxHeight = 'none';
        clone.removeAttribute('id');
        document.body.appendChild(clone);
    }

    clone.value = candidateValue;
    clone.style.width = getComputedStyle(el).width;

    clone.style.height = 'auto';
    let h = clone.scrollHeight;
    if (isBorderBox) h += border;

    return h > maxH + 0.5;
}

function bind(el) {
    resize(el);

    el.addEventListener('beforeinput', (e) => {
        const maxH = getMaxHeight(el);
        if (!maxH) return;

        const candidate = nextValueAfterBeforeInput(el, e);
        if (wouldExceed(el, candidate, maxH)) {
            e.preventDefault();
        }
    });

    el.addEventListener('input', () => resize(el), { passive: true });

    el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const maxH = getMaxHeight(el);
        if (!maxH) return;
        if (wouldExceed(el, el.value + '\n', maxH) && el.selectionStart === el.selectionEnd) {
            e.preventDefault();
        }
    });

    if (el.form) {
        el.form.addEventListener('reset', () => requestAnimationFrame(() => resize(el)));
    }

    const ro = new ResizeObserver(() => resize(el));
    ro.observe(el);
    let t;
    const onWinResize = () => { clearTimeout(t); t = setTimeout(() => resize(el), 50); };
    window.addEventListener('resize', onWinResize);

    if (document.fonts?.ready) {
        document.fonts.ready.then(() => resize(el));
    }

    el._autosizeCleanup = () => {
        ro.disconnect();
        window.removeEventListener('resize', onWinResize);
    };
}

export function autosize(root = document) {
    root.querySelectorAll('textarea[data-autosize]').forEach(bind);

    const mo = new MutationObserver(muts => {
    for (const m of muts) {
        m.addedNodes.forEach(n => {
            if (!(n instanceof Element)) return;
            if (n.matches?.('textarea[data-autosize]')) bind(n);
            n.querySelectorAll?.('textarea[data-autosize]').forEach(bind);
        });
    }
    });
    mo.observe(root, { childList: true, subtree: true });

    if (document.fonts?.ready) {
        document.fonts.ready.then(() => {
            root.querySelectorAll('textarea[data-autosize]').forEach(resize);
        });
    }
}
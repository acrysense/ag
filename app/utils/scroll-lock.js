let scrollTop = 0;
const FIX_SELECTOR = '[data-fix]';
const HTML = document.documentElement;

function computePageHeight() {
    const b = document.body;
    const h = document.documentElement;
    return Math.max(
        h.scrollHeight, h.offsetHeight, h.clientHeight,
        b ? Math.max(b.scrollHeight, b.offsetHeight, b.clientHeight) : 0
    );
}

function applyGradientHeight(pageH) {
    if (!(HTML.classList.contains('bg-gradient-y') || HTML.classList.contains('bg-gradient-x'))) return;
    const footerH = parseFloat(getComputedStyle(HTML).getPropertyValue('--footer-h')) || 0;
    const gradH = Math.max(0, pageH - footerH);
    HTML.style.setProperty('--grad-h', `${gradH}px`);
}

function measureAndApply() {
    const pageH = computePageHeight();
    applyGradientHeight(pageH);
    return pageH;
}

window.addEventListener('load', measureAndApply);
window.addEventListener('resize', measureAndApply);

export function lockBody() {
    const b = document.body;
    if (b.classList.contains('is-locked')) return;

    measureAndApply();

    scrollTop = window.pageYOffset || HTML.scrollTop || 0;
    const pad = window.innerWidth - HTML.clientWidth;

    b.style.top = `-${scrollTop}px`;
    b.classList.add('is-locked');
    HTML.classList.add('is-locked');

    if (pad > 0) {
        b.style.paddingRight = `${pad}px`;
        document.querySelectorAll(FIX_SELECTOR).forEach((el) => {
            if (el && el.style) el.style.paddingRight = `${pad}px`;
        });
    }
}

export function unlockBody() {
    const b = document.body;
    if (!b.classList.contains('is-locked')) return;

    const y = Math.abs(parseInt(b.style.top || '0', 10)) || 0;

    b.classList.remove('is-locked');
    HTML.classList.remove('is-locked');

    b.style.top = '';
    b.style.paddingRight = '';
    document.querySelectorAll(FIX_SELECTOR).forEach((el) => {
        if (el && el.style) el.style.paddingRight = '';
    });

    window.scrollTo(0, y);

    requestAnimationFrame(measureAndApply);
}
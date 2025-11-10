export default (root) => {
    if (!root || root.__profileBound) return;
    root.__profileBound = true;

    const trigger = root.querySelector('.profile__trigger');
    const panel = root.querySelector('.profile__dropdown');
    const inner = panel?.querySelector('.profile__dropdown-inner') || panel?.firstElementChild;
    if (!trigger || !panel || !inner) return;

    const DURATION = 300;
    let anim = null;
    let token = 0;
    let isOpenFact = false;
    let desiredOpen = false;

    trigger.type = 'button';
    if (!panel.id) panel.id = `profile-dd-${Math.random().toString(36).slice(2,9)}`;
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    panel.style.overflow = 'hidden';
    panel.style.height = '0px';

    const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0);
    const curHeight = () => num(getComputedStyle(panel).height);
    const openHeight = () => inner.scrollHeight;

    function reflectImmediateVisual(open) {
        root.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function finish(open, selfToken) {
        if (selfToken !== token) return;
        anim = null;
        isOpenFact = open;
        panel.style.height = '';
        panel.style.overflow = '';
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function animateTo(open) {
        anim?.cancel();
        token++;
        const selfToken = token;

        const from = curHeight();
        const to = open ? openHeight() : 0;

        panel.style.overflow = 'hidden';
        panel.style.height = `${from}px`;
        panel.offsetHeight;

        if (!panel.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
            panel.style.height = `${to}px`;
            setTimeout(() => finish(open, selfToken), DURATION);
            return;
        }

        anim = panel.animate(
            [{ height: `${from}px` }, { height: `${to}px` }],
            { duration: DURATION, easing: 'ease', fill: 'forwards' }
        );
        anim.onfinish = () => finish(open, selfToken);
    }

    function setDesired(open) {
        desiredOpen = open;
        reflectImmediateVisual(desiredOpen);
        animateTo(desiredOpen);
    }

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const currentlyGoingToOpen = anim ? desiredOpen : isOpenFact;
        setDesired(!currentlyGoingToOpen);
    });

    root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (anim || isOpenFact) setDesired(false);
        }
    });
};
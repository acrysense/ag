export default (root) => {
    if (!root || root.__bound) return;
    root.__bound = true;

    const burger = root.querySelector('.header__hamburger');

    burger?.addEventListener('click', (e) => {
        e.preventDefault();
        if (document.documentElement.dataset.sidebarBusy === '1') return;

        const isOpen = document.documentElement.classList.contains('sidebar-open');
        document.dispatchEvent(new CustomEvent(isOpen ? 'sidebar:close' : 'sidebar:open', { bubbles: true }));
    });
};
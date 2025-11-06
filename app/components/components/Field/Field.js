export default (root) => {
    if (!root || root.__pwdVisBound) return;
    root.__pwdVisBound = true;

    const controls = root.querySelectorAll('.field__control');
        controls.forEach((ctrl) => {
            const btn   = ctrl.querySelector('.field__visibility');
            const input = ctrl.querySelector('.field__input');

            if (!btn || !input || input.type !== 'password') return;

            btn.setAttribute('type', 'button');
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', 'Показать пароль');
            btn.classList.toggle('is--active', false);

            btn.addEventListener('click', (e) => {
            e.preventDefault();

            const on   = btn.getAttribute('aria-pressed') === 'true';
            const caret = input.selectionStart;

            btn.setAttribute('aria-pressed', String(!on));
            btn.setAttribute('aria-label', on ? 'Показать пароль' : 'Скрыть пароль');
            btn.classList.toggle('is--active', !on);

            input.type = on ? 'password' : 'text';

            requestAnimationFrame(() => {
                input.focus({ preventScroll: true });
                if (caret != null) input.setSelectionRange(caret, caret);
            });
        });
    });
};
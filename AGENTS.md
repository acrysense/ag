# AGENTS.md

Instructions for Codex and other AI agents working in this repository.

## Main rules

- Do not change design, HTML structure, text, images or project SCSS without an explicit task.
- Do not turn `ag` into a copy of `vite-starter`.
- Use `vite-starter` only as the build architecture reference.
- Do not bring back `vite-plugin-imagemin`, `vite-plugin-svg-icons`, `vite-plugin-handlebars` or
  `vite-plugin-static-copy` without a specific reason.
- Do not run `npm audit fix --force`.
- Do not make major migrations without separate approval.
- Do not remove dependencies before checking real imports and usage.
- Do not add libraries "just in case".
- Do not change visual behavior for internal "cleanliness".

## JS and lifecycle

- Every new interactive module must return a disposer.
- Every `addEventListener` must have a matching `removeEventListener`.
- Timers must be cleared.
- RAF handles must be cancelled.
- Observers must be disconnected.
- Fetch and async operations must not update DOM after unmount.
- Swiper, Inputmask and other instances must be destroyed in dispose.
- Repeated mount must not duplicate listeners.
- Scroll-lock must stay compatible with nested modals.

## SCSS

- Do not change reset/base/layout without checking visual consequences.
- Do not add global styles that can affect the whole project.
- Add new styles next to the corresponding component or section.
- Do not remove project styles just because they differ from `vite-starter`.

## Assets

- Do not delete images, icons or fonts without checking references.
- SVG sprite sources must use a regular `<svg>...</svg>` structure.
- Icons that should inherit color must be prepared for `currentColor`.
- Raw assets can be duplicated in `dist` for CMS/raw links; this is expected.
- Optimize images separately, not during the Vite build.

## Required checks

After code or build changes, run:

```sh
npm run build
BASE=/demo/ npm run build
BASE=/demo/ npm run build -- --mode cms
npm audit --omit=dev
npm audit
npm ls
git diff --check
```

If only `README.md` or `AGENTS.md` changed, the full build matrix can be skipped, but the final answer
must explicitly say that runtime code did not change.

## Git hygiene

- Check `git status`, `git diff --stat` and `git diff --check` before committing.
- Do not commit `dist`, `node_modules`, logs, caches or sandbox artifacts.
- Inspect `git diff --cached --stat` before every commit.
- Keep build, lifecycle and documentation commits separate when practical.

## Final report format

Always report:

- what changed;
- which files changed;
- which commands ran;
- whether runtime code changed;
- what still needs manual browser verification.

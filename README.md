# AG frontend

Multi-page frontend project for AG, built on the current Vite starter architecture.

The project keeps its own design, content, sections, styles and behavior. The starter is used only as
the build/lifecycle baseline.

## Requirements

- Node.js `22.16.0` or newer;
- npm `10` or newer;
- `nvm use` reads `.nvmrc`.

```sh
nvm use
npm ci
```

## Development

```sh
npm run dev
```

If a managed sandbox returns `EPERM` on `listen`, treat it as an environment limitation when the Vite
config has already loaded.

## Production build

Default production build:

```sh
npm run build
```

Build for a subpath:

```sh
BASE=/demo/ npm run build
```

CMS mode keeps page links under CMS control while still prefixing assets and supported data URLs:

```sh
BASE=/demo/ npm run build -- --mode cms
```

## Checks

```sh
npm audit --omit=dev
npm audit
npm ls
git diff --check
```

Before release or after build/runtime changes, also run:

```sh
npm run build
BASE=/demo/ npm run build
BASE=/demo/ npm run build -- --mode cms
```

## Project structure

```text
app/
  app.js                    # app entry, SVG sprite registration, module mount
  pages/                    # HTML entry points
  components/
    layouts/                # page layout partials
    sections/               # page sections
    components/             # reusable UI components
  core/
    mount.js                # data-module mount/dispose lifecycle
  utils/                    # shared runtime utilities
  assets/
    styles/                 # SCSS base/layout/components/sections
    icons/                  # SVG sprite sources
    fonts/                  # WOFF2/WOFF sources
    images/                 # raw images
    videos/                 # raw videos
    lottie/                 # raw lottie assets
    json/                   # raw JSON assets
public/                     # files copied as-is by Vite
tools/
  build-fonts.mjs           # font copy and @font-face generation
```

## HTML and HBS partials

Pages live in `app/pages`. Partials live in `app/components` and are referenced by path without the
file extension:

```hbs
{{> layouts/Header/Header }}
{{> sections/shared/Promo/Promo }}
{{> components/ProfileDropdown/ProfileDropdown }}
```

The local Handlebars plugin registers `.hbs` and `.html` partials, injects global data from
`site.config.json`, and supports page-specific `<page>.page.json` metadata where needed.

Useful helpers include `asset`, `attrs`, `obj`, `arr`, `default`, `or`, `and`, `eq`, `cls`, `json`,
`striptags`, `isSet`, `isEmpty` and `not`.

## SVG sprite

SVG icons are stored in `app/assets/icons`. The local SVG plugin creates an inline sprite from these
files and registers it through `virtual:svg-icons-register`.

Use icons as:

```html
<svg aria-hidden="true" focusable="false">
	<use href="#icon-close"></use>
</svg>
```

Nested icon paths become nested IDs, for example `app/assets/icons/social/mail.svg` becomes
`#icon-social-mail`.

Do not bring back `vite-plugin-svg-icons` unless there is a specific project-level reason.

## Fonts

The font pipeline expects ready web fonts:

```text
app/assets/fonts/Inter/Inter-Var.woff2
app/assets/fonts/Inter/Inter-Var-Italic.woff2
```

`npm run fonts` runs automatically before `dev` and `build`. It copies fonts to `public/fonts` and
generates `app/assets/styles/base/_fonts.generated.scss`.

Configure family names and variable weight ranges in `fonts.config.json`. Do not edit the generated
SCSS file manually.

## Raw assets

Raw assets are copied during production build:

```text
app/assets/images/** -> dist/assets/images/**
app/assets/videos/** -> dist/assets/videos/**
app/assets/lottie/** -> dist/assets/lottie/**
app/assets/json/**   -> dist/assets/json/**
```

This is expected for CMS/runtime paths. Some files can also appear as hashed Vite assets when they are
referenced from HTML/CSS/JS.

## Project libraries

The project intentionally keeps only libraries that are used:

- `swiper` for project sliders and galleries;
- `inputmask` for masked fields;
- `handlebars` for local HTML/HBS rendering during build.

Do not remove dependencies without checking imports and actual usage. Do not add libraries "just in
case".

## Images

Images are no longer optimized automatically during `npm run build`. Optimize source images before
publication or add a separate project-specific prebuild script.

Do not restore `vite-plugin-imagemin` as part of ordinary project work.

## Runtime lifecycle

Interactive modules are mounted through `data-module` and `data-path`:

```html
<section data-module="Package" data-path="sections/package"></section>
```

Modules may return a disposer. New interactive code must release everything it creates:

- DOM/window/document listeners;
- timers and intervals;
- `requestAnimationFrame`;
- observers;
- fetch/async work after unmount;
- Swiper/Inputmask/other instances;
- object URLs and temporary DOM.

Use `requestMount(root)` and `requestUnmount(root)` from `app/core/mount.js` for CMS/AJAX DOM updates.

## Known limitations

- `PhotoViewer` is still a page-level singleton.
- Replacing the entire `PhotoViewer` DOM without a page reload is not supported.
- Older modules `Accordion`, `Field`, `Profile`, `ProfileEdit` and `AvatarUpload` are not fully
  unified for frequent CMS/AJAX DOM replacement.
- Normal page lifecycle works, but frequent replacement of those older DOM fragments needs a separate
  dispose audit.

import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { resolve, sep } from 'node:path'
import fg from 'fast-glob'
import handlebars from 'vite-plugin-handlebars'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import viteImagemin from 'vite-plugin-imagemin'
import autoprefixer from 'autoprefixer'
import { html as beautifyHtml } from 'js-beautify'

let BASE: string = '/';
const BUILD_MODE = process.env.MODE || '';
let PREFIX_PAGE_LINKS = BUILD_MODE !== 'cms'; 

const isExternalLike = (p: string) =>
    !p ||
    p.startsWith('#') ||
    p.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(p);

const withBase = (p: string) => {
    if (isExternalLike(p)) return p;
    const base = BASE.endsWith('/') ? BASE : BASE + '/';
    const norm = p.replace(/^\//, '');
    if (norm.startsWith(base.replace(/^\//, ''))) return p;
    return base + norm;
};

function captureBase() {
    return {
        name: 'capture-base',
        enforce: 'pre',
        configResolved(cfg: any) {
            BASE = cfg.base || '/';
            console.log(`[capture-base] BASE=${BASE} MODE=${BUILD_MODE} prefixPageLinks=${PREFIX_PAGE_LINKS}`);
        }
    }
}

function fixSrcset(v: string) {
    return String(v)
        .split(',')
        .map(s => {
            const part = s.trim();
            if (!part) return part;
            const [url, ...rest] = part.split(/\s+/);
            const patched = withBase(url);
            return [patched, ...rest].join(' ');
        })
        .join(', ');
}

function prefixDataAttrs(html: string, fileName: string) {
    const RE = /\s(data-[\w:-]*?(?:src|href|poster)[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

    let changed = 0;
    const samples: string[] = [];

    const patched = html.replace(RE, (m, name, dq, sq, bare) => {
        const val = dq ?? sq ?? bare ?? '';
        const next = withBase(val);
        if (next !== val) {
            changed++;
            if (samples.length < 6) samples.push(`${name}: ${val} → ${next}`);
        }
        const quoted = dq != null ? `"${next}"` : (sq != null ? `'${next}'` : `"${next}"`);
        return ` ${name}=${quoted}`;
    });

    if (changed) {
        console.log(`[prefixDataAttrs] ${fileName}: changed=${changed}\n  ${samples.join('\n  ')}`);
    } else {
        console.log(`[prefixDataAttrs] ${fileName}: no changes`);
    }

    return patched;
}

function prefixPageLinks(html: string, fileName: string) {
    if (!PREFIX_PAGE_LINKS) {
        console.log(`[prefixPageLinks] ${fileName}: skipped (MODE=${BUILD_MODE})`);
        return html;
    }

    const DISALLOW_FIRST_SEG = new Set(['assets','fonts','favicon','images','img','videos','media','static','@']);
    const EXT_BLOCK = new Set([
        'png','jpg','jpeg','gif','svg','webp','avif','ico',
        'mp4','webm','mov','ogg','mp3','wav',
        'woff','woff2','ttf','otf','eot',
        'css','js','json','xml','txt','pdf','webmanifest','map'
    ]);

    let changed = 0;
    const samples: string[] = [];

    const patched = html.replace(/<a\b[^>]*?>/gi, (tag) => {
        return tag.replace(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
            (m, dq, sq, bare) => {
                const val = dq ?? sq ?? bare ?? '';

                if (isExternalLike(val)) return m;
                if (!val.startsWith('/')) return m;

                const base = BASE.endsWith('/') ? BASE : BASE + '/';
                if (val.replace(/^\//,'').startsWith(base.replace(/^\//,''))) return m;

                const [pathPart] = val.split(/[?#]/);
                const firstSeg = pathPart.replace(/^\//,'').split('/')[0].toLowerCase();
                if (DISALLOW_FIRST_SEG.has(firstSeg)) return m;

                const last = pathPart.split('/').pop() || '';
                const ext = last.includes('.') ? last.split('.').pop()!.toLowerCase() : '';
                if (EXT_BLOCK.has(ext)) return m;

                const next = withBase(val);
                if (next !== val) {
                    changed++;
                    if (samples.length < 6) samples.push(`href: ${val} → ${next}`);
                }
                const quoted = dq != null ? `"${next}"` : (sq != null ? `'${next}'` : `"${next}"`);
                return ` href=${quoted}`;
            }
        );
    });

    if (changed) {
        console.log(`[prefixPageLinks] ${fileName}: changed=${changed}\n  ${samples.join('\n  ')}`);
    } else {
        console.log(`[prefixPageLinks] ${fileName}: no changes`);
    }
    return patched;
}

function beautifyAndGapHtml() {
    return {
        name: 'beautify-and-gap-html',
        apply: 'build',
        enforce: 'post',
        writeBundle(options, bundle) {
            const outDir = options.dir || path.dirname(options.file || '');
            for (const fileName of Object.keys(bundle)) {
                if (!fileName.endsWith('.html')) continue;

                const abs = path.join(outDir, fileName);
                if (!fs.existsSync(abs)) continue;

                let html = fs.readFileSync(abs, 'utf8');

                const EOL = html.includes('\r\n') ? '\r\n' : '\n';
                html = html.replace(/\r\n/g, '\n');

                html = beautifyHtml(html, {
                    indent_with_tabs: true,
                    indent_size: 1,
                    indent_inner_html: true,
                    wrap_line_length: 0,
                    preserve_newlines: true,
                    max_preserve_newlines: 1,
                    end_with_newline: true,
                    wrap_attributes: 'auto',
                    wrap_attributes_indent_size: 1,
                });

                html = html.replace(/<head\b[^>]*>([\s\S]*?)<\/head>/i, (full, inner) => {
                    const lines = inner.split('\n');
                    const idx = lines.findIndex(l =>
                        /^\s*<script\b/i.test(l) ||
                        (/^\s*<link\b/i.test(l) && /\brel=["'](?:modulepreload|stylesheet)["']/.test(l))
                    );
                    if (idx <= 0) return full;

                    if (lines[idx - 1].trim() !== '') {
                        lines.splice(idx, 0, '');
                    }

                    const newInner = lines.join('\n');
                    return full.replace(inner, newInner);
                });

                html = html.replace(/\n/g, EOL);
                html = prefixDataAttrs(html, fileName);
                html = prefixPageLinks(html, fileName);
                fs.writeFileSync(abs, html);
            }
        }
    };
}

function copyStaticVideos() {
    return {
        name: 'copy-static-videos',
        apply: 'build',
        closeBundle() {
            const srcDir = path.resolve(__dirname, 'app/assets/videos')
            const outDir = path.resolve(__dirname, 'dist/assets/videos')
            if (!fs.existsSync(srcDir)) {
                console.log('[copy-static-videos] no app/assets/videos')
                return
            }
            const files = fg.sync('**/*.{mp4,webm,mov,ogg}', { cwd: srcDir })
            fs.mkdirSync(outDir, { recursive: true })
            for (const rel of files) {
                const from = path.join(srcDir, rel)
                const to   = path.join(outDir, rel)
                fs.mkdirSync(path.dirname(to), { recursive: true })
                fs.copyFileSync(from, to)
            }
            console.log(`[copy-static-videos] copied ${files.length} files`)
        }
    }
}

function devPagesRouter() {
    const flattenKey = (relFromApp) =>
        relFromApp
            .replace(/^pages\//, '')
            .replace(/\([^)]*\)\//g, '')
            .replace(/\.html$/, '')
            .replace(/[\\/]/g, '-')

    const buildMap = () => {
        const files = fg.sync('app/pages/**/*.html', { dot: false })
        const map = new Map<string, string>()
        for (const abs of files) {
            const relFromApp = path.relative('app', abs).replace(/\\/g, '/')
            const direct = '/' + relFromApp.replace(/^pages\//, '')
            const flat = '/' + flattenKey(relFromApp) + '.html'

            map.set(direct, '/' + relFromApp)
            map.set(flat, '/' + relFromApp)
        }
        return map
    }

    return {
        name: 'dev-pages-router',
        apply: 'serve',
        configureServer(server) {
            let MAP = buildMap()
            server.watcher.on('add', (p) => p.endsWith('.html') && (MAP = buildMap()))
            server.watcher.on('unlink', (p) => p.endsWith('.html') && (MAP = buildMap()))

            server.middlewares.use((req, _res, next) => {
                const url = (req.url || '/').split('?')[0]

                if (
                    url.startsWith('/assets/') || url.startsWith('/fonts/') ||
                    url.startsWith('/favicon/') || url.startsWith('/@')
                ) return next()

                if (url === '/') {
                    req.url = '/pages/index.html'
                    return next()
                }

                if (MAP.has(url)) {
                    req.url = MAP.get(url)!
                    return next()
                }

                if (!/\.[a-z0-9]+$/i.test(url)) {
                    const withHtml = url.replace(/\/+$/, '') + '.html'
                    if (MAP.has(withHtml)) {
                        req.url = MAP.get(withHtml)!
                        return next()
                    }
                }

                const candidate = '/pages' + (/\.[a-z0-9]+$/i.test(url) ? url : url + '.html')
                if (fs.existsSync(path.resolve('app' + candidate))) {
                    req.url = candidate
                }

                next()
            })
        }
    }
}

function loadJSON(p: string) {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch (e: any) {
        if (e?.code !== 'ENOENT') {
            console.error('[site.config.json] parse/load error:', e?.message, 'at', p)
        }
        return null
    }
}

function outNameFromHtmlPath(absHtmlPath: string) {
    const appRoot = resolve(__dirname, 'app') + sep
    const rel = absHtmlPath.startsWith(appRoot) ? absHtmlPath.slice(appRoot.length) : absHtmlPath

    const clean = rel.replace(/^[/\\]+/, '')

    return clean
        .replace(/^pages[\\/]/, '')
        .replace(/\([^)]*\)[\\/]/g, '')
        .replace(/\.html$/, '')
        .replace(/[\\/]/g, '-')
}

function getHtmlInputs() {
    const root = resolve(__dirname, 'app')
    const files = fg.sync('pages/**/*.html', { cwd: root, dot: false })
    const inputs: Record<string, string> = {}
    for (const file of files) {
        const name = file
            .replace(/^pages\//, '')
            .replace(/\([^)]*\)\//g, '')
            .replace(/\.html$/, '')
            .replace(/[\\/]/g, '-')
        inputs[name] = resolve(root, file)
    }
    return inputs
}

function flattenPagesToRoot() {
    return {
        name: 'flatten-pages-to-root',
        apply: 'build',
        enforce: 'post',
        generateBundle(_: any, bundle: Record<string, any>) {
            for (const [fileName, asset] of Object.entries(bundle)) {
                if (asset?.type !== 'asset' || !fileName.endsWith('.html')) continue;
                if (!fileName.startsWith('pages/')) continue;

                const newName = fileName.split('/').pop()!;
                const source = String(asset.source ?? '');

                this.emitFile({ type: 'asset', fileName: newName, source });
                delete bundle[fileName];
            }
        },
    };
}

const paintToCurrentColor = {
	name: 'paintToCurrentColor',
	type: 'visitor',
	fn() {
		const isPaintUrl = (v: unknown) => typeof v === 'string' && v.startsWith('url(')
		return {
			element: {
				enter(node: any) {
					const a = node.attributes || {}
					if ('fill' in a && a.fill !== 'none' && a.fill !== 'currentColor' && !isPaintUrl(a.fill)) {
						a.fill = 'currentColor'
					}
					if ('stroke' in a && a.stroke !== 'none' && a.stroke !== 'currentColor' && !isPaintUrl(a.stroke)) {
						a.stroke = 'currentColor'
						if (!('fill' in a)) a.fill = 'none'
					}
				}
			}
		}
	}
}

export default defineConfig(({ command }) => {
	const isBuild = command === 'build'

	return {
		root: 'app',
		base: process.env.BASE || '/',
		publicDir: resolve(__dirname, 'public'),
		resolve: { alias: { '@': resolve(__dirname, 'app') } },
		server: { open: '/' },

		build: {
			outDir: resolve(__dirname, 'dist'),
			emptyOutDir: true,
			cssCodeSplit: true,
			manifest: 'manifest.json',
			rollupOptions: {
				input: getHtmlInputs(),
				output: {
					manualChunks(id) {
						if (id.includes('node_modules')) return 'vendor'
						return 'app'
					},
					entryFileNames: 'assets/js/[name]-[hash].js',
					chunkFileNames: 'assets/js/[name]-[hash].js',
					assetFileNames: ({ name }) => {
						const ext = (name?.split('.').pop() || '').toLowerCase()
						if (/png|jpe?g|gif|svg|webp|avif|ico/.test(ext)) return 'assets/images/[name]-[hash][extname]'
						if (/mp4|webm|mov|ogg/.test(ext)) return 'assets/videos/[name]-[hash][extname]'
						if (/woff2?|ttf|otf|eot/.test(ext)) return 'assets/fonts/[name]-[hash][extname]'
						if (ext === 'css') return 'assets/css/[name]-[hash][extname]'
						return 'assets/[name]-[hash][extname]'
					}
				}
			},
			sourcemap: false
		},

		plugins: [
            captureBase(),
            devPagesRouter(),
            handlebars({
                partialDirectory: resolve(__dirname, 'app/components'),
                reloadOnPartialChange: true,

                helpers: {
                    asset(v: any) {
                        return typeof v === 'string' ? withBase(v) : v;
                    },
                    attrs(obj:any){
                        if(!obj || typeof obj!=='object') return '';
                        const urlish = new Set([
                            'href','src','poster','srcset',
                            'data-src','data-src-mp4','data-src-webm',
                            'data-src-mp4-mobile','data-src-mp4-desktop',
                            'data-src-mobile','data-src-desktop'
                        ]);
                        return Object.entries(obj)
                            .filter(([_,v]) => v !== null && v !== undefined && v !== false)
                            .map(([k,v])=>{
                                let val = v;
                                if (typeof v === 'string') {
                                    if (k === 'srcset') val = fixSrcset(v);
                                    else if (urlish.has(k)) val = withBase(v);
                                }
                                return `${k}="${String(val).replace(/"/g,'&quot;')}"`;
                            }).join(' ');
                    },
                    default(v: any, fb: any) {
                        return (v !== undefined && v !== null && v !== '') ? v : fb
                    },
                    add(a: any, b: any) {
                        return Number(a)+Number(b)
                    },
                    obj(...args) {
                        const options = args[args.length - 1];
                        const hasOptions = options && typeof options === 'object' && 'hash' in options;
                        const params = hasOptions ? args.slice(0, -1) : args;

                        if (hasOptions && options.hash && Object.keys(options.hash).length) {
                            return options.hash;
                        }

                        if (params.length && params.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
                            return Object.assign({}, ...params);
                        }

                        const out = {};
                        for (let i = 0; i < params.length; i += 2) {
                            const k = params[i]; const v = params[i + 1];
                            if (k != null) out[String(k)] = v;
                        }
                        return out;
                    },
                    arr(...args: any[]) {
                        args.pop();
                        return args
                    },
                    and(...args: any[]) { 
                        args.pop(); return args.every(Boolean)
                    },
                    eq(a: any, b: any) {
                        return a === b
                    },
                    cls(cond: any, token: string) {
                        return cond ? ` ${token}` : ''
                    },
                    json(v: any) {
                        return JSON.stringify(v)
                    },
                    striptags(v: any) {
                        return String(v ?? '').replace(/<[^>]*>/g, '');
                    },
                    or(...args: any[]) {
                        args.pop();
                        for (const v of args) if (v) return v;
                        return '';
                    },
                    isSet(...args: any[]) {
                        args.pop();
                        const v = args[0];
                        if (v === undefined || v === null) return false;
                        if (typeof v === 'string') return v.trim() !== '';
                        if (Array.isArray(v)) return v.length > 0;
                        if (typeof v === 'object') return Object.keys(v).length > 0;
                        return true;
                    },
                    isEmpty(...args: any[]) {
                        args.pop();
                        const v = args[0];
                        if (v === undefined || v === null) return true;
                        if (typeof v === 'string') return v.trim() === '';
                        if (Array.isArray(v)) return v.length === 0;
                        if (typeof v === 'object') return Object.keys(v).length === 0;
                        return false;
                    },
                    not(v:any) {
                        return !v;
                    },
                },

                context: (htmlPath) => {
                    const site = loadJSON(resolve(__dirname, 'site.config.json')) || {}

                    const baseMeta = [
                        { charset: 'utf-8' },
                        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                        ...((Array.isArray(site.meta) ? site.meta : []).filter(
                            (m: any) => !('charset' in m) && m?.name !== 'viewport'
                        )),
                    ]

                    const linksAll = Array.isArray(site.link) ? site.link : []
                    const linkPreload = linksAll.filter((l: any) => l?.rel === 'preload')
                    const linkOther = linksAll.filter((l: any) => l?.rel !== 'preload')

                    const outName = outNameFromHtmlPath(htmlPath)
                    const pageJsonPath = htmlPath.replace(/\.html$/, '.page.json')
                    const pageCfg = loadJSON(pageJsonPath) || {}

                    const title = pageCfg.title || site.seoDefaults?.title || site.siteName || ''
                    const description = pageCfg.description || site.seoDefaults?.description || ''
                    const ogImage = pageCfg.ogImage || site.seoDefaults?.ogImage || ''
                    const twitterCard = pageCfg.twitterCard || site.seoDefaults?.twitterCard || 'summary_large_image'

                    let canonical = pageCfg.canonical || ''
                    if (!canonical && site.siteUrl) {
                        canonical = new URL(outName === 'index' ? '/' : `/${outName}.html`, site.siteUrl).toString()
                    }

                    return {
                        site,
                        lang: site.lang || 'ru',

                        baseMeta,
                        meta: [],
                        linkPreload,
                        linkOther,

                        page: { canonical },
                        head: { title, description, ogImage, twitterCard },
                    }
                }
            }),
			createSvgIconsPlugin({
				iconDirs: [resolve(process.cwd(), 'app/assets/icons')],
				symbolId: 'icon-[name]',
				svgoOptions: {
					multipass: true,
					plugins: [
						{ name: 'preset-default', params: { overrides: {
							removeViewBox: false,
							cleanupIds: false
						}}},
						{ name: 'removeDimensions' },
						{ name: 'prefixIds', params: { prefix: 'i-' } },
						paintToCurrentColor
					]
				}
			}),
			isBuild && viteImagemin({
				svgo: {
					plugins: [
						{ name: 'preset-default', params: { overrides: {
							removeViewBox: false,
						}}},
						{ name: 'cleanupNumericValues', params: { floatPrecision: 3 } },
						{ name: 'convertPathData', params: { floatPrecision: 3 } }
					]
				},
				pngquant: { quality: [0.7, 0.85], speed: 1, strip: true },
				mozjpeg: { quality: 78, progressive: true, optimizeCoding: true },
				gifsicle: { optimizationLevel: 3 },
				webp: { quality: 78 },
				avif: { quality: 50 }
			}),
            flattenPagesToRoot(),
            beautifyAndGapHtml(),
            copyStaticVideos(),
		].filter(Boolean),

		css: {
			devSourcemap: true,
			postcss: {
				plugins: [
					autoprefixer(),
				]
			}
		}
	}
})
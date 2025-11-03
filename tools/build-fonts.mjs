import { promises as fs } from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import ttf2woff2 from 'ttf2woff2'
import ttf2woffModule from 'ttf2woff'

const ttf2woff = ttf2woffModule.default || ttf2woffModule

const SRC = path.resolve('app/assets/fonts')
const OUT = path.resolve('public/fonts')
const STYLES_OUT = path.resolve('app/assets/styles/base/_fonts.generated.scss')
const CONFIG_PATH = path.resolve('fonts.config.json')

const MAKE_WOFF   = process.env.LEGACY === '1'
const VAR_SUFFIX  = 'Var'
const STRIP_PT_SIZE = true

function normalizeBase(s){ if(!s) return '/'; if(!s.startsWith('/')) s='/'+s; if(!s.endsWith('/')) s+='/'; return s; }
const BASE = normalizeBase(process.env.BASE || '/');

const ensureDir = (p) => fs.mkdir(p, { recursive: true })

const isVariableFile = (base) => {
    const s = base.toLowerCase()
    return (
        /\[.*\bwght\b.*\]/.test(s) ||
        /variablefont(?:[_-]|$)/.test(s) ||
        /variable(?:[_-]|$)/.test(s) ||
        /\bvf(?:[_-]|$)/.test(s)
    )
}

const isItalicFile = (base) => /\bitalic\b/i.test(base)

const WEIGHT_TOKENS = [
    { re: /\bthin\b/i,        w: 100 },
    { re: /\b(extralight|ultralight)\b/i, w: 200 },
    { re: /\blight\b/i,       w: 300 },
    { re: /\bbook\b/i,        w: 350 },
    { re: /\b(regular|normal)\b/i, w: 400 },
    { re: /\bmedium\b/i,      w: 500 },
    { re: /\b(semibold|demibold)\b/i, w: 600 },
    { re: /\bbold\b/i,        w: 700 },
    { re: /\b(extra|ultra)bold\b/i, w: 800 },
    { re: /\b(black|heavy)\b/i, w: 900 }
]

function guessWeight(base) {
    for (const { re, w } of WEIGHT_TOKENS) {
        if (re.test(base)) return w
    }
    return 400
}

function normalizeBaseName(origBase) {
    let name = origBase.replace(/\.(ttf|otf)$/i, '')
    name = name.replace(/\[.*?\]/g, '')
    name = name
        .replace(/[-_ ]?VariableFont[_-].*$/i, '')
        .replace(/[-_ ]?Variable[_-]?.*$/i, '')
        .replace(/[-_ ]?VF[_-]?.*$/i, '')
    if (STRIP_PT_SIZE) name = name.replace(/([_-])\d+pt\b/ig, '')
    name = name.replace(/,/g, '').replace(/[ ]{2,}/g, ' ').trim()
    name = name.replace(/[_ ]+/g, '-').replace(/-+/g, '-')
    return name
}

function outName(base) {
    const variable = isVariableFile(base)
    let clean = normalizeBaseName(path.basename(base))
    if (variable) {
        if (/[-]Italic$/i.test(clean)) clean = clean.replace(/[-]Italic$/i, `-${VAR_SUFFIX}-Italic`)
        else clean = `${clean}-${VAR_SUFFIX}`
    }
    return clean
}

const toWebPath = (relDir, filename) => {
    const dir = relDir && relDir !== '.' ? relDir.split(path.sep).join('/') + '/' : ''
    return `${BASE}fonts/${dir}${filename}`
}

async function readConfig() {
    try {
        const raw = await fs.readFile(CONFIG_PATH, 'utf8')
        const parsed = JSON.parse(raw)
        return {
            defaults: {
                display: parsed?.defaults?.display ?? 'swap',
                varWght: parsed?.defaults?.varWght ?? '300 700'
            },
            families: parsed?.families ?? {}
        }
    } catch {
        return { defaults: { display: 'swap', varWght: '300 700' }, families: {} }
    }
}

function pickCssFamily(cfg, folderName) {
    const fam = cfg.families?.[folderName]
    return fam?.cssFamily || folderName
}

function pickVarRange(cfg, folderName, italic) {
    const fam = cfg.families?.[folderName]
    if (fam) {
        const key = italic ? 'italic' : 'normal'
        if (fam[key]?.varWght)   return fam[key].varWght
        if (fam.normal?.varWght) return fam.normal.varWght
        if (fam.italic?.varWght) return fam.italic.varWght
    }
    return cfg.defaults.varWght
}

const files = await fg(['**/*.{ttf,otf,TTF,OTF}'], { cwd: SRC, absolute: true })

if (!files.length) {
    await writeStub('No font sources found');
    process.exit(0);
}

const cfg = await readConfig()

let converted = 0
let skipped = 0
const fontFaces = []

for (const abs of files) {
    const rel    = path.relative(SRC, abs)
    const relDir = path.dirname(rel)
    const base   = path.basename(abs)

    const variable = isVariableFile(base)
    const italic   = isItalicFile(base)
    const outBase  = outName(base)

    const outDir = path.join(OUT, relDir)
    await ensureDir(outDir)

    const srcStat = await fs.stat(abs)

    const w2Path = path.join(outDir, `${outBase}.woff2`)
    let needW2 = true
    try {
        const w2Stat = await fs.stat(w2Path)
        if (w2Stat.mtimeMs >= srcStat.mtimeMs && w2Stat.size > 0) needW2 = false
    } catch {}
    if (needW2) {
        const buf = await fs.readFile(abs)
        const w2 = ttf2woff2(buf)
        await fs.writeFile(w2Path, Buffer.from(w2))
        converted++
    } else {
        skipped++
    }

    let w1WebUrl = null
    if (MAKE_WOFF && !variable) {
        const w1Path = path.join(outDir, `${outBase}.woff`)
        let needW1 = true
        try {
            const w1Stat = await fs.stat(w1Path)
            if (w1Stat.mtimeMs >= srcStat.mtimeMs && w1Stat.size > 0) needW1 = false
        } catch {}
        if (needW1) {
            const buf = await fs.readFile(abs)
            const w1  = Buffer.from(ttf2woff(buf).buffer)
            await fs.writeFile(w1Path, w1)
            converted++
        } else {
            skipped++
        }
        w1WebUrl = toWebPath(relDir, `${outBase}.woff`)
    }

    const folderFamily = (relDir && relDir.split(path.sep)[0]) || normalizeBaseName(base).split('-')[0]
    const cssFamily    = pickCssFamily(cfg, folderFamily)

    const urlW2 = toWebPath(relDir, `${outBase}.woff2`)

    if (variable) {
        fontFaces.push({
            kind: 'var',
            cssFamily,
            fileWoff2: urlW2,
            style: italic ? 'italic' : 'normal',
            wght: pickVarRange(cfg, folderFamily, italic)
        })
    } else {
        fontFaces.push({
            kind: 'static',
            cssFamily,
            fileWoff2: urlW2,
            fileWoff: w1WebUrl,
            style: italic ? 'italic' : 'normal',
            weight: guessWeight(base)
        })
    }
}

function uniqueOrder(arr, keyFn) {
    const seen = new Set();
    const out = [];
    for (const it of arr) {
        const key = keyFn(it);
        if (!seen.has(key)) { seen.add(key); out.push(it); }
    }
    return out;
}

const faces = uniqueOrder(fontFaces, (f) => JSON.stringify(f));

const TAB = '\t';
const NL  = '\n';

const emitStatic = (f, pad = '') => {
    const srcParts = [`url("${f.fileWoff2}") format("woff2")`];
    if (f.fileWoff) srcParts.push(`url("${f.fileWoff}") format("woff")`);
    const src = srcParts.length === 1
        ? srcParts[0] + ';'
        : srcParts[0] + ',' + NL + pad + TAB + '     ' + srcParts[1] + ';';

    return [
        `${pad}@font-face {`,
        `${pad}${TAB}font-family: "${f.cssFamily}";`,
        `${pad}${TAB}src: ${src}`,
        `${pad}${TAB}font-weight: ${f.weight};`,
        `${pad}${TAB}font-style: ${f.style};`,
        `${pad}${TAB}font-display: ${cfg.defaults.display};`,
        `${pad}}`,
    ].join(NL);
};

const emitVar = (v, pad = '') => [
    `${pad}@font-face {`,
    `${pad}${TAB}font-family: "${v.cssFamily}";`,
    `${pad}${TAB}src: url("${v.fileWoff2}") format("woff2-variations");`,
    `${pad}${TAB}font-weight: ${v.wght};`,
    `${pad}${TAB}font-style: ${v.style};`,
    `${pad}${TAB}font-display: ${cfg.defaults.display};`,
    `${pad}}`,
].join(NL);

let css =
    `/* ⚠️ AUTOGENERATED. Do not edit.
        Update sources in ${path.relative(process.cwd(), SRC)} and rerun the script.
        Mode: ${MAKE_WOFF ? 'legacy (woff + woff2 for static)' : 'modern (woff2 only)'} */` + NL + NL;

const statics = faces.filter(x => x.kind === 'static');
if (statics.length) {
    css += statics.map(f => emitStatic(f)).join(NL + NL) + NL + NL;
}

const vars = faces.filter(x => x.kind === 'var');
if (vars.length) {
    css += '@supports (font-variation-settings: normal) {' + NL;
    css += vars.map(v => emitVar(v, TAB)).join(NL + NL) + NL;
    css += '}' + NL;
}

await fs.mkdir(path.dirname(STYLES_OUT), { recursive: true });
await fs.writeFile(STYLES_OUT, css.trimEnd());

async function writeStub(reason = 'no fonts') {
    const banner = `/* ⚠️ AUTOGENERATED (stub): ${reason}.
        Update fonts in ${path.relative(process.cwd(), SRC)} and re-run the script. */\n`;
    const stub = `${banner}\n`;
    await fs.mkdir(path.dirname(STYLES_OUT), { recursive: true });
    await fs.writeFile(STYLES_OUT, stub);
    console.log(`Stub CSS → ${path.relative(process.cwd(), STYLES_OUT)}`);
}

console.log(`Fonts CSS → ${path.relative(process.cwd(), STYLES_OUT)}`)
console.log(`Fonts: ${converted} built, ${skipped} up-to-date → ${path.relative(process.cwd(), OUT)}`)
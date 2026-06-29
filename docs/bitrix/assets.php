<?php
/**
 * Подключение собранных Vite-ассетов в шаблон Bitrix по manifest.json.
 *
 * ВАЖНО про наш манифест:
 *   - в нём НЕ выставляется "isEntry" и НЕТ ключей *.html;
 *   - единственный вход — общий чанк с "name": "app"
 *     (ключ вида "_app-<hash>.js"), его CSS лежит в поле "css".
 *   Поэтому вход ищем по name === 'app', а НЕ по isEntry
 *   (иначе функция молча ничего не подключит — это и был баг).
 *
 * Куда класть собранное:
 *   Пути "file"/"css" в манифесте уже включают префикс "assets/"
 *   (например "assets/js/app-<hash>.js"). Значит $dir должен указывать
 *   на папку, КУДА скопирован КОРЕНЬ dist (там лежат и manifest.json,
 *   и подпапка assets/). Тогда итоговый URL = $dir . '/assets/js/...'.
 *
 *   В нашем случае dist кладётся в КОРЕНЬ шаблона /bitrix/templates/auth/,
 *   поэтому $dir = SITE_TEMPLATE_PATH (см. дефолт ниже), а сборка делается
 *   с BASE=/bitrix/templates/auth/ (чтобы ленивые чанки тоже резолвились).
 */

use Bitrix\Main\Page\Asset;

function tpl_load_manifest(string $dir): array {
	static $cache = [];
	if (!isset($cache[$dir])) {
		$file = $_SERVER['DOCUMENT_ROOT'] . $dir . '/manifest.json';
		$cache[$dir] = is_file($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
	}
	return $cache[$dir];
}

function tpl_add_vite(?string $entry = null, string $dir = null): void {
	// dist лежит в корне шаблона → manifest.json в SITE_TEMPLATE_PATH,
	// а пути в манифесте уже содержат "assets/". Если кладёте dist в другое
	// место — передайте свой $dir (папку, где лежит manifest.json).
	$dir = $dir ?? SITE_TEMPLATE_PATH;
	$manifest = tpl_load_manifest($dir);
	if (!$manifest) return;

	$rec = null;
	if ($entry) $rec = $manifest[$entry] ?? $manifest['src/' . $entry] ?? null;

	// ФИКС: вход определяем по name === 'app' (isEntry в нашем манифесте нет).
	if (!$rec) foreach ($manifest as $k => $v) {
		if (!empty($v['isEntry']) || ($v['name'] ?? '') === 'app') { $rec = $v; $entry = $k; break; }
	}
	if (!$rec || empty($rec['file'])) return;

	$A = Asset::getInstance();
	$addCss     = fn(string $href) => $A->addCss($dir . '/' . ltrim($href, '/'));
	$addPreload = fn(string $href) => $A->addString('<link rel="modulepreload" crossorigin href="' . $dir . '/' . ltrim($href, '/') . '">');
	$addModule  = fn(string $src)  => $A->addString('<script type="module" crossorigin src="' . $dir . '/' . ltrim($src, '/') . '"></script>');

	// CSS зависимостей входа (если у импортов есть свои стили) + preload их JS
	if (!empty($rec['imports'])) {
		foreach ($rec['imports'] as $impKey) {
			$sub = $manifest[$impKey] ?? null;
			if (!$sub) continue;
			if (!empty($sub['css'])) foreach ($sub['css'] as $css) $addCss($css);
			if (!empty($sub['file'])) $addPreload($sub['file']);
		}
	}
	// CSS самого входа (наш app-<hash>.css)
	if (!empty($rec['css'])) foreach ($rec['css'] as $css) $addCss($css);

	$addPreload($rec['file']);
	$addModule($rec['file']);

	// ПРИМЕЧАНИЕ про crossorigin:
	//   атрибут crossorigin нужен, если ассеты отдаются с другого origin/CDN.
	//   Если /assets закрыт HTTP-авторизацией (Basic-auth) — браузер запросит
	//   их БЕЗ кук → 401 и стили/скрипты не подключатся. В этом случае либо
	//   уберите crossorigin в $addModule/$addPreload, либо снимите авторизацию
	//   с пути к ассетам.
}

function tpl_add_entry(?string $entry = null, string $dir = null): void {
	tpl_add_vite($entry, $dir ?? SITE_TEMPLATE_PATH);
}

'use strict';
// 多言語管理マネージャー (i18n core)

window.I18N = (function () {
  const STORAGE_KEY = 'ip-please-lang';
  const DEFAULT_LANG = 'zh-CN';

  let availableLangs = { 'zh-CN': '简体中文' };
  let currentLang = DEFAULT_LANG;
  let bundles = {};

  function initSync() {
    // 1. assets.js に事前バンドルされたデータがあれば展開
    if (window.ASSETS && window.ASSETS.locales) {
      bundles = Object.assign({}, window.ASSETS.locales);
      for (const code in bundles) {
        if (bundles[code]._meta && bundles[code]._meta.name) {
          availableLangs[code] = bundles[code]._meta.name;
        }
      }
    }

    // 2. 言語設定の決定
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && availableLangs[saved]) {
      currentLang = saved;
    } else {
      currentLang = DEFAULT_LANG;
    }
  }

  async function loadLang(lang) {
    if (bundles[lang]) return;
    if (location.protocol.startsWith('http')) {
      try {
        const res = await fetch(`locales/${lang}.json`);
        if (res.ok) {
          bundles[lang] = await res.json();
          if (bundles[lang]._meta && bundles[lang]._meta.name) {
            availableLangs[lang] = bundles[lang]._meta.name;
          }
        }
      } catch (e) {
        console.warn(`[i18n] Failed to fetch locale ${lang}:`, e);
      }
    }
  }

  async function init() {
    initSync();
    await loadLang(currentLang);
  }

  // 文字列取得関数 (ドット記法・プレースホルダー対応)
  function t(path, params = {}, fallback = '') {
    if (!path) return '';
    const keys = path.split('.');
    let cur = bundles[currentLang];
    for (const k of keys) {
      if (cur && cur[k] !== undefined) cur = cur[k];
      else { cur = null; break; }
    }

    // カレント言語に存在しない場合はデフォルト言語にフォールバック
    if (cur === null && currentLang !== DEFAULT_LANG) {
      cur = bundles[DEFAULT_LANG];
      for (const k of keys) {
        if (cur && cur[k] !== undefined) cur = cur[k];
        else { cur = null; break; }
      }
    }

    if (cur === null || cur === undefined) {
      cur = fallback || path;
    }

    // パラメータ置換 ({var})
    if (typeof cur === 'string') {
      return cur.replace(/{(\w+)}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
    }
    return cur;
  }

  async function setLanguage(lang) {
    if (!availableLangs[lang] && !location.protocol.startsWith('http')) return;
    await loadLang(lang);
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
    if (typeof window.onLanguageChange === 'function') {
      window.onLanguageChange(lang);
    }
  }

  // 即時初期化（同期可能な部分）
  initSync();

  return {
    init,
    loadLang,
    t,
    setLanguage,
    getLanguage: () => currentLang,
    getLanguages: () => availableLangs,
    getBundles: () => bundles,
    setBundle: (code, data) => {
      bundles[code] = data;
      if (data && data._meta && data._meta.name) {
        availableLangs[code] = data._meta.name;
      }
    },
  };
})();

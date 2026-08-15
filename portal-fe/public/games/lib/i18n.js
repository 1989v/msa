/* sitelock — 무단 재호스팅 방지. 정식 배포 도메인과 로컬 개발에서만 실행된다. */
(function () {
  var h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h === "1989v.com" || /\.1989v\.com$/.test(h)) return;
  var msg = function () {
    document.body.innerHTML = "<div style=\"font:16px sans-serif;color:#eee;background:#111;position:fixed;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px\">이 게임은 <a href=\"https://game.1989v.com\" style=\"color:#6cf;margin-left:6px\"> game.1989v.com</a> 에서만 플레이할 수 있습니다.</div>";
  };
  if (document.body) msg(); else document.addEventListener("DOMContentLoaded", msg);
  throw new Error("sitelock");
})();
/**
 * 게임 공통 i18n — 브라우저 언어 자동 감지 + 전역 언어 전환.
 *
 * 언어 결정: localStorage('game_lang') → navigator.language(ko* → ko, 그 외 en).
 * 포털(React)과 전 게임(iframe, 동일 오리진)이 같은 키를 공유해 한 번 바꾸면 전체에 적용된다.
 *
 * 사용:
 *   GameI18n.init({ ko: {...}, en: {...} })   → 게임별 문자열 사전 등록 (스크립트 최상단)
 *   GameI18n.t('key')                          → 현재 언어 문자열 (누락 시 ko → key 순 폴백)
 *   GameI18n.lang                              → 'ko' | 'en'
 *   HTML 정적 텍스트: <span data-i18n="key">…</span> → DOMContentLoaded 때 자동 치환
 *   (data-i18n 요소의 원문은 ko 사전과 일치할 필요 없다 — key 로만 찾는다)
 *
 * 우상단에 언어 토글(한/EN)이 자동 부착된다. 전환 시 저장 후 reload.
 */
(function () {
  'use strict';
  var KEY = 'game_lang';

  var lang = localStorage.getItem(KEY);
  if (lang !== 'ko' && lang !== 'en') {
    lang = /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
  }

  var dict = { ko: {}, en: {} };

  function init(strings) {
    dict = strings || dict;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDom);
    else applyDom();
  }

  function t(key) {
    var pack = dict[lang] || {};
    if (Object.prototype.hasOwnProperty.call(pack, key)) return pack[key];
    var fb = dict.ko || {};
    return Object.prototype.hasOwnProperty.call(fb, key) ? fb[key] : key;
  }

  function applyDom() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var ph = document.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < ph.length; j++) {
      ph[j].setAttribute('placeholder', t(ph[j].getAttribute('data-i18n-ph')));
    }
  }

  function set(next) {
    if (next !== 'ko' && next !== 'en') return;
    localStorage.setItem(KEY, next);
    location.reload();
  }

  function mountToggle() {
    var b = document.createElement('button');
    b.id = 'langToggle';
    b.textContent = lang === 'ko' ? 'EN' : '한';
    b.title = lang === 'ko' ? 'Switch to English' : '한국어로 전환';
    b.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;padding:4px 10px;font-size:11px;' +
      'border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.45);' +
      'color:#fff;cursor:pointer;font-family:inherit;opacity:.75';
    b.onmouseenter = function () { b.style.opacity = '1'; };
    b.onmouseleave = function () { b.style.opacity = '.75'; };
    b.onclick = function () { set(lang === 'ko' ? 'en' : 'ko'); };
    document.body.appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle);
  else mountToggle();

  window.GameI18n = { lang: lang, t: t, set: set, init: init, apply: applyDom };
})();

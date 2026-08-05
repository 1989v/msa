/**
 * 게임 공통 랭킹 위젯 — 닉네임당 최고 기록.
 *
 * 사용:
 *   GameRank.submit(slug, score, detail)  → 종료 시 호출. 첫 제출 때 닉네임을 묻는다(localStorage 보관).
 *                                           Promise<{applied, rank}|null> (실패/취소 시 null)
 *   GameRank.panel(slug, el)              → el 에 TOP10 리더보드를 그린다 (메뉴 화면용)
 *
 * i18n: lib/i18n.js(GameI18n)가 로드돼 있으면 그 언어를 따르고, 없으면 ko.
 */
(function () {
  'use strict';
  var NICK_KEY = 'game_nickname';

  var STR = {
    ko: {
      askNick: '랭킹에 올릴 닉네임 (2~16자)', top10: '🏆 랭킹 TOP 10', loading: '🏆 랭킹 불러오는 중…',
      empty: '아직 기록이 없다 — 1등을 가져가라!', fail: '랭킹을 불러오지 못했다',
      copy: '📋 복사', copied: '✅ 복사됨', noCode: '코드 없음', copyPrompt: '코드를 복사하세요',
    },
    en: {
      askNick: 'Nickname for the leaderboard (2-16 chars)', top10: '🏆 TOP 10', loading: '🏆 Loading leaderboard…',
      empty: 'No records yet — claim first place!', fail: 'Could not load the leaderboard',
      copy: '📋 Copy', copied: '✅ Copied', noCode: 'No code', copyPrompt: 'Copy your code',
    },
  };
  function L(key) {
    var lang = (window.GameI18n && GameI18n.lang) || 'ko';
    return (STR[lang] || STR.ko)[key];
  }

  function nickname(forcePrompt) {
    var n = localStorage.getItem(NICK_KEY);
    if (n && !forcePrompt) return n;
    n = (prompt(L('askNick'), n || '') || '').trim();
    if (n.length < 2 || n.length > 16) return null;
    localStorage.setItem(NICK_KEY, n);
    return n;
  }

  function submit(slug, score, detail) {
    var nick = nickname(false);
    if (!nick || !(score > 0)) return Promise.resolve(null);
    return fetch('/api/v1/games/' + slug + '/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nick, score: Math.floor(score), detail: detail || null }),
    }).then(function (r) { return r.json(); })
      .then(function (b) { return b && b.success ? b.data : null; })
      .catch(function () { return null; });
  }

  function panel(slug, el) {
    if (!el) return;
    el.innerHTML = '<div style="opacity:.6;font-size:11px">' + L('loading') + '</div>';
    fetch('/api/v1/games/' + slug + '/leaderboard?limit=10')
      .then(function (r) { return r.json(); })
      .then(function (b) {
        var rows = (b && b.success && b.data) || [];
        var mine = localStorage.getItem(NICK_KEY);
        var html = '<div style="font-size:12px;font-weight:bold;margin-bottom:5px">' + L('top10') + '</div>';
        if (!rows.length) html += '<div style="opacity:.6;font-size:11px">' + L('empty') + '</div>';
        else html += rows.map(function (r) {
          var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : (r.rank + '.');
          var me = mine && r.nickname === mine;
          return '<div style="display:flex;gap:7px;font-size:11.5px;line-height:1.9;' +
            (me ? 'color:#ffd54a;font-weight:bold' : '') + '">' +
            '<span style="width:22px;text-align:right">' + medal + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            escapeHtml(r.nickname) + '</span>' +
            '<span>' + Number(r.score).toLocaleString() + '</span>' +
            (r.detail ? '<span style="opacity:.55">' + escapeHtml(r.detail) + '</span>' : '') +
            '</div>';
        }).join('');
        el.innerHTML = html;
      })
      .catch(function () { el.innerHTML = '<div style="opacity:.5;font-size:11px">' + L('fail') + '</div>'; });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 메뉴 패널(#menu) 하단에 리더보드를 자동 부착하고, 종료→복귀 시 재갱신 */
  function autoPanel(slug) {
    function mount() {
      var menu = document.getElementById('menu');
      if (!menu) return;
      var el = document.createElement('div');
      el.id = 'rankPanel';
      el.style.cssText = 'min-width:270px;max-width:340px;text-align:left;background:rgba(0,0,0,.22);' +
        'border-radius:8px;padding:9px 12px;margin-top:4px';
      menu.appendChild(el);
      panel(slug, el);
      // 종료 화면에서 돌아올 때 갱신
      var back = document.getElementById('backBtn');
      if (back) back.addEventListener('click', function () { setTimeout(function () { panel(slug, el); }, 200); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  /**
   * 이어하기 코드 복사 버튼.
   * #codeShow 를 flex 래퍼로 감싸 블록/인라인 어느 레이아웃에서도 코드 옆에 정렬시키고,
   * 코드가 비어 있으면 버튼도 숨긴다 (MutationObserver 로 표시 동기화).
   */
  function copyButton(getCode) {
    function mount() {
      var cs = document.getElementById('codeShow');
      if (!cs) return;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap';
      cs.parentNode.insertBefore(wrap, cs);
      wrap.appendChild(cs);
      var b = document.createElement('button');
      b.textContent = L('copy');
      b.style.cssText = 'padding:3px 9px;font-size:10px;border-radius:5px;border:0;' +
        'background:rgba(255,255,255,.14);color:inherit;cursor:pointer;font-family:inherit';
      b.onclick = function () {
        var code = getCode && getCode();
        if (!code) { b.textContent = L('noCode'); setTimeout(function () { b.textContent = L('copy'); }, 1200); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
          .then(function () { b.textContent = L('copied'); })
          .catch(function () { window.prompt(L('copyPrompt'), code); })
          .finally(function () { setTimeout(function () { b.textContent = L('copy'); }, 1500); });
      };
      wrap.appendChild(b);
      function sync() { b.style.display = cs.textContent.trim() ? '' : 'none'; }
      sync();
      new MutationObserver(sync).observe(cs, { childList: true, characterData: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  window.GameRank = { submit: submit, panel: panel, nickname: nickname, autoPanel: autoPanel, copyButton: copyButton };
})();

/**
 * 게임 공통 랭킹 위젯 — 닉네임당 최고 기록.
 *
 * 사용:
 *   GameRank.submit(slug, score, detail)  → 종료 시 호출. 첫 제출 때 닉네임을 묻는다(localStorage 보관).
 *                                           Promise<{applied, rank}|null> (실패/취소 시 null)
 *   GameRank.panel(slug, el)              → el 에 TOP10 리더보드를 그린다 (메뉴 화면용)
 */
(function () {
  'use strict';
  var NICK_KEY = 'game_nickname';

  function nickname(forcePrompt) {
    var n = localStorage.getItem(NICK_KEY);
    if (n && !forcePrompt) return n;
    n = (prompt('랭킹에 올릴 닉네임 (2~16자)', n || '') || '').trim();
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
    el.innerHTML = '<div style="opacity:.6;font-size:11px">🏆 랭킹 불러오는 중…</div>';
    fetch('/api/v1/games/' + slug + '/leaderboard?limit=10')
      .then(function (r) { return r.json(); })
      .then(function (b) {
        var rows = (b && b.success && b.data) || [];
        var mine = localStorage.getItem(NICK_KEY);
        var html = '<div style="font-size:12px;font-weight:bold;margin-bottom:5px">🏆 랭킹 TOP 10</div>';
        if (!rows.length) html += '<div style="opacity:.6;font-size:11px">아직 기록이 없다 — 1등을 가져가라!</div>';
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
      .catch(function () { el.innerHTML = '<div style="opacity:.5;font-size:11px">랭킹을 불러오지 못했다</div>'; });
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

  /** #codeShow 옆에 이어하기 코드 복사 버튼 부착 */
  function copyButton(getCode) {
    function mount() {
      var cs = document.getElementById('codeShow');
      if (!cs) return;
      var b = document.createElement('button');
      b.textContent = '📋 복사';
      b.style.cssText = 'margin-left:7px;padding:3px 9px;font-size:10px;border-radius:5px;border:0;' +
        'background:rgba(255,255,255,.14);color:inherit;cursor:pointer;font-family:inherit';
      b.onclick = function () {
        var code = getCode && getCode();
        if (!code) { b.textContent = '코드 없음'; setTimeout(function () { b.textContent = '📋 복사'; }, 1200); return; }
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
          .then(function () { b.textContent = '✅ 복사됨'; })
          .catch(function () { window.prompt('코드를 복사하세요', code); })
          .finally(function () { setTimeout(function () { b.textContent = '📋 복사'; }, 1500); });
      };
      cs.parentNode.insertBefore(b, cs.nextSibling);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  window.GameRank = { submit: submit, panel: panel, nickname: nickname, autoPanel: autoPanel, copyButton: copyButton };
})();

/**
 * 게임 공통 랭킹 위젯 — 닉네임당 최고 기록.
 *
 * 사용:
 *   GameRank.submit(slug, score, detail)  → 종료 시 호출. Promise<{applied, rank}|null>
 *                                           닉네임이 없으면 기록을 들고 있다가 닉네임이 정해지는
 *                                           즉시 자동 제출한다 (조용히 버리지 않는다).
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
      nickPh: '닉네임 (2~16자)', nickSave: '저장', nickSaved: '✅ 저장됨',
      pending: '닉네임을 정하면 이번 기록({n})이 등록된다', submitted: '✅ 랭킹 등록 — {n}위',
      submitFail: '랭킹 등록 실패 — 잠시 후 다시 시도',
    },
    en: {
      askNick: 'Nickname for the leaderboard (2-16 chars)', top10: '🏆 TOP 10', loading: '🏆 Loading leaderboard…',
      empty: 'No records yet — claim first place!', fail: 'Could not load the leaderboard',
      copy: '📋 Copy', copied: '✅ Copied', noCode: 'No code', copyPrompt: 'Copy your code',
      nickPh: 'Nickname (2-16 chars)', nickSave: 'Save', nickSaved: '✅ Saved',
      pending: 'Set a nickname to submit this score ({n})', submitted: '✅ Ranked #{n}',
      submitFail: 'Could not submit — try again shortly',
    },
  };
  function L(key) {
    var lang = (window.GameI18n && GameI18n.lang) || 'ko';
    return (STR[lang] || STR.ko)[key];
  }

  /**
   * 게임은 sandbox iframe 안에서 돈다. 그 안에서는 `allow-modals` 가 없으면 prompt() 가
   * **아무것도 띄우지 않고 즉시 null 을 반환**한다 — 예전 구현이 이걸 "취소"로 읽어
   * 랭킹 제출을 조용히 포기했다(직접 URL 로 열면 되는데 사이트에서만 안 되던 원인).
   * 그래서 닉네임 입력은 브라우저 모달이 아니라 패널 안의 인라인 필드로 받는다.
   */
  var pending = null;   // { slug, score, detail } — 닉네임이 정해지면 자동 제출
  var listeners = [];

  function nickname() { return localStorage.getItem(NICK_KEY); }

  function setNickname(raw) {
    var n = String(raw || '').trim();
    if (n.length < 2 || n.length > 16) return null;
    localStorage.setItem(NICK_KEY, n);
    listeners.forEach(function (fn) { fn(n); });
    if (pending) { var p = pending; pending = null; postScore(p.slug, p.score, p.detail); }
    return n;
  }

  function postScore(slug, score, detail) {
    return fetch('/api/v1/games/' + slug + '/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nickname(), score: Math.floor(score), detail: detail || null }),
    }).then(function (r) { return r.json(); })
      .then(function (b) {
        var d = b && b.success ? b.data : null;
        note(d ? L('submitted').replace('{n}', d.rank) : L('submitFail'));
        return d;
      })
      .catch(function () { note(L('submitFail')); return null; });
  }

  /** 닉네임이 없으면 버리지 않고 들고 있는다 — 정해지는 즉시 자동 제출된다. */
  function submit(slug, score, detail) {
    if (!(score > 0)) return Promise.resolve(null);
    if (!nickname()) {
      pending = { slug: slug, score: score, detail: detail };
      note(L('pending').replace('{n}', Math.floor(score).toLocaleString()));
      return Promise.resolve(null);
    }
    return postScore(slug, score, detail);
  }

  var noteEl = null;
  function note(text) { if (noteEl) noteEl.textContent = text; }

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

  /** 닉네임 인라인 편집기 — 모달을 쓰지 않아 sandbox iframe 에서도 동작한다. */
  function nickEditor(onSaved) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:5px;margin-bottom:6px';
    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = L('nickPh');
    input.value = nickname() || '';
    input.style.cssText = 'flex:1;min-width:0;font-family:inherit;font-size:11.5px;padding:4px 7px;' +
      'border-radius:5px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit';
    var btn = document.createElement('button');
    btn.textContent = L('nickSave');
    btn.style.cssText = 'padding:4px 9px;font-size:10.5px;border-radius:5px;border:0;' +
      'background:rgba(255,255,255,.14);color:inherit;cursor:pointer;font-family:inherit';
    function save() {
      if (!setNickname(input.value)) { input.focus(); return; }
      btn.textContent = L('nickSaved');
      setTimeout(function () { btn.textContent = L('nickSave'); }, 1200);
      if (onSaved) onSaved();
    }
    btn.onclick = save;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    // 다른 경로(게임 코드 등)로 닉네임이 바뀌어도 필드가 어긋나지 않게 한다
    listeners.push(function (n) { input.value = n; });
    wrap.append(input, btn);
    return wrap;
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

      var board = document.createElement('div');
      el.appendChild(nickEditor(function () { panel(slug, board); }));
      noteEl = document.createElement('div');
      noteEl.style.cssText = 'font-size:11px;color:#8fd0ff;min-height:14px;margin:2px 0 4px';
      el.appendChild(noteEl);
      el.appendChild(board);
      panel(slug, board);
      // 종료 화면에서 돌아올 때 갱신
      var back = document.getElementById('backBtn');
      if (back) back.addEventListener('click', function () { setTimeout(function () { panel(slug, board); }, 200); });
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
        // sandbox iframe 에서는 prompt() 가 무반응이라 폴백으로 쓸 수 없다.
        // 임시 input 에 담아 선택 상태로 만들어 사용자가 직접 복사할 수 있게 한다.
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
          .then(function () { b.textContent = L('copied'); })
          .catch(function () {
            var t = document.createElement('input');
            t.value = code;
            t.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:9999;' +
              'font-size:12px;padding:4px 8px;text-align:center;width:190px';
            document.body.appendChild(t);
            t.select();
            try { document.execCommand('copy'); b.textContent = L('copied'); } catch (_) { b.textContent = L('copyPrompt'); }
            setTimeout(function () { t.remove(); }, 2500);
          })
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

  window.GameRank = { submit: submit, panel: panel, nickname: nickname, setNickname: setNickname,
    onNickname: function (fn) { listeners.push(fn); }, autoPanel: autoPanel, copyButton: copyButton };
})();

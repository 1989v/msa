/**
 * 데일리 퍼즐 공용 헬퍼 — KST 자정 롤오버 날짜 시드 + 스트릭 + 결과 공유.
 *
 * 사용:
 *   GameDaily.todayKey()             → 'YYYY-MM-DD' (KST 기준)
 *   GameDaily.dayNumber(epoch)       → epoch('YYYY-MM-DD')부터 1-base 일차 (#N 표기용)
 *   GameDaily.seed(slug)             → 오늘 날짜+slug 로 결정되는 uint32 시드
 *   GameDaily.rng(seed)              → mulberry32 — 0≤x<1 결정적 난수 함수
 *   GameDaily.shuffle(arr, rand)     → 제자리 Fisher-Yates (rand 는 rng 산출물)
 *   GameDaily.result(slug) / saveResult(slug, obj)
 *                                    → 오늘 클리어 결과 저장/조회 (재제출·재플레이 방지)
 *   GameDaily.recordClear(slug)      → 스트릭 갱신. {streak, best} 반환
 *   GameDaily.streak(slug)           → {streak, best} (기록 없으면 0)
 *   GameDaily.countdown(el)          → el 에 다음 KST 자정까지 남은 시간 표시 (1초 갱신)
 *   GameDaily.share(text, btn)       → 클립보드 복사 + 버튼 피드백 (실패 시 prompt 폴백)
 *   GameDaily.fmtTime(sec)           → '1:42' 형식
 */
(function () {
  'use strict';

  var KST_MS = 9 * 3600 * 1000;

  function kstNow() { return new Date(Date.now() + KST_MS); }

  function todayKey() { return kstNow().toISOString().slice(0, 10); }

  function dayNumber(epoch) {
    var e = Date.parse(epoch + 'T00:00:00+09:00');
    return Math.floor((Date.now() - e) / 86400000) + 1;
  }

  function hash32(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }

  function seed(slug) { return hash32(slug + '@' + todayKey()); }

  function rng(s) {
    var a = s >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* 저장 불가 환경 무시 */ }
  }

  function saveResult(slug, obj) {
    write('daily_result_' + slug, { day: todayKey(), r: obj });
  }
  function result(slug) {
    var v = read('daily_result_' + slug);
    return v && v.day === todayKey() ? v.r : null;
  }

  function streak(slug) {
    var v = read('daily_streak_' + slug) || { last: '', streak: 0, best: 0 };
    // 어제도 오늘도 아니면 이미 끊긴 스트릭 — 표시용으로 0 처리
    var today = todayKey();
    var yest = new Date(Date.parse(today + 'T00:00:00+09:00') - 86400000 + KST_MS)
      .toISOString().slice(0, 10);
    var cur = (v.last === today || v.last === yest) ? v.streak : 0;
    return { streak: cur, best: v.best };
  }

  function recordClear(slug) {
    var today = todayKey();
    var yest = new Date(Date.parse(today + 'T00:00:00+09:00') - 86400000 + KST_MS)
      .toISOString().slice(0, 10);
    var v = read('daily_streak_' + slug) || { last: '', streak: 0, best: 0 };
    if (v.last !== today) {
      v.streak = v.last === yest ? v.streak + 1 : 1;
      v.last = today;
      if (v.streak > v.best) v.best = v.streak;
      write('daily_streak_' + slug, v);
    }
    return { streak: v.streak, best: v.best };
  }

  function countdown(el) {
    if (!el) return;
    function tick() {
      var now = kstNow();
      var next = new Date(now); next.setUTCHours(24, 0, 0, 0);
      var s = Math.max(0, Math.floor((next - now) / 1000));
      el.textContent = String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
        String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' +
        String(s % 60).padStart(2, '0');
    }
    tick();
    setInterval(tick, 1000);
  }

  function share(text, btn) {
    var done = function () {
      if (!btn) return;
      var orig = btn.textContent;
      btn.textContent = '✅';
      setTimeout(function () { btn.textContent = orig; }, 1400);
    };
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(done)
      .catch(function () { window.prompt('결과를 복사하세요', text); });
  }

  function fmtTime(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  window.GameDaily = {
    todayKey: todayKey, dayNumber: dayNumber, seed: seed, rng: rng, shuffle: shuffle,
    saveResult: saveResult, result: result, streak: streak, recordClear: recordClear,
    countdown: countdown, share: share, fmtTime: fmtTime,
  };
})();

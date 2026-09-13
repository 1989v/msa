# T05A-3 · 회피

직접 실행:
```text
node --test implementation/t02a/tests/dodge.test.mjs implementation/t05a/tests/guardian.test.mjs
# tests 10
# pass 10
# fail 0
node release/build-beta.mjs
Built docs/specs/2026-09-10-skybound/release/dist/index.html (5 payload files; metadata added)
```

지상/기력/재사용 제한,20한번소비,고정tick분할에서동일1.96m회피거리,오르막단차/점프버퍼/reset,타격시점기준0.18초무적(일반피격무적연장없음),자세overlay복원을확인했다. 기존반격/복귀관련검사도통과했다.

추가브라우저/전체회귀는실행하지않았다. 회피는낮은자세대시이며완성된구르기모션은아니다. 일반장식물/표적몸체의이동충돌은아직없다.

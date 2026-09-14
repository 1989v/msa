# T05B-1 · 이동 수호석

`node --test implementation/t05b/tests/patrol.test.mjs` → tests4,pass4,fail0.
`node release/build-beta.mjs` → Built release/dist/index.html.

순찰/접근/거리유지/복귀,정지·공격중동결/쓰러짐/reset,지형구멍·단차·차단콜백,화면/공격대상/반격주체의좌표일치와이동중체력유지를직접확인했다. 브라우저/전체회귀는추가하지않았다. 길찾기우회·별도다리걷기애니메이션·두번째적종류는미구현이다.

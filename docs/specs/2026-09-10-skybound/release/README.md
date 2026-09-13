# 바람의 유적 · 개발 베타 패키지

레포 루트에서 빌드:

```sh
node docs/specs/2026-09-10-skybound/release/build-beta.mjs
```

독립 배포 폴더: `docs/specs/2026-09-10-skybound/release/dist/` (생성물, Git 제외).
HTML, minified JS/CSS, `assets/naru-lod0.glb`, 오픈소스 고지, 크기/SHA-256 메타데이터를 포함한다. 실행 시 외부 CDN은 필요 없다. 빌드에는 설치된 `portal-fe/node_modules`의 Three/esbuild가 필요하다. 기존 개발 뷰어의 캐릭터 경로는 유지한다.

로컬 실행:

```sh
python3 -m http.server 8770 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound/release/dist
```

`http://127.0.0.1:8770/` 접속. `file://`로 열지 않는다. 정적 호스팅에는 dist의 내용 전체를 함께 올리며, 하위 경로는 마지막 `/`로 끝나도록 서버에서 정규화한다. 빌드 명령은 자기 생성물인 dist를 새 결과로 교체한다.

현재는 배포 준비본이며 공개 URL이 없다. [공개 조건](beta-readiness.md)의 통합 플레이 점검과 공개 주소 확정이 남았다. 게임 저장은 없으며 새로고침/출발점 reset은 진행을 초기화한다.

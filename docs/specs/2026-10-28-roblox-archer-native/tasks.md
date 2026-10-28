<!-- source: roblox/archer-command/src/server/Main.server.luau, roblox/archer-command/tools/verify.py -->

# Tasks — 궁수 키우기 로블록스 네이티브 재개발

- [x] 1 공유 규칙 `Config.luau`·`Rules.luau`·`Theme.luau` + `tests/rules.spec.luau`
- [x] 2 서버: `World.server.luau`(Terrain·조명 프리셋) · `Rigs.luau`(리그 템플릿·애니메이션) · `Npc.luau`(아군 추종·사격·목수 채집·적 추적·공격) · `Campaign.luau`(사냥터·거점·전초기지·웨이브·역습) · `Towers.luau` · `Save.luau` · `Commands.luau` · `Main.server.luau`
- [x] 3 클라이언트: `Camera.client.luau`(기본 + 쿼터뷰 전환) · `Effects.client.luau`(화살·섬광·명중·피해 숫자·사망 페이드·소리) · `Hud.client.luau`
- [x] 4 빌더 `tools/build.py`(Terrain 은 런타임, Roblox 소유 XML 모델 내장·스크립트 제거·배치, 목책·천막·탑 템플릿·게이트·Remotes·Lighting) · `tools/verify.py` 네이티브 게이트 · 게이트 증명
- [x] 5 README · ASSETS · status · 하네스 원장 · 메모리 · 커밋

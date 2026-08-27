<!-- source: docs/standards/unity-game-pipeline.md -->
# 유니티 웹게임 제작 라인 실행 플랜 — 템플릿 · 하네스 · 프롬프트

- 작성: 2026-08-27
- 근거: `docs/standards/unity-game-pipeline.md` (준비 문서 — 이 플랜이 끝나면 정식 표준으로 승격)
- 상속: `docs/standards/game-cleanroom-pipeline.md` 전역 가드레일 G1~G5 · 품질 게이트 · 통합 절차
- 목표: **앞으로 유니티(WebGL)로 만드는 웹게임이 전부 같은 규약**을 따르게 한다 —
  프로젝트 골격(템플릿) · 플랫폼 브릿지 · 빌드/서빙 경로 · 정적 검사(하네스) · 제작 프롬프트(스킬)

## 0. 전제 — 환경은 갖춰졌다 (2026-08-27 확인)

준비 문서의 "Unity 미설치라 파일럿 불가" 전제는 **더 이상 사실이 아니다.**

| 항목 | 확인값 |
|---|---|
| Unity Editor | `6000.5.9f1` (arm64) — `/Applications/Unity/Hub/Editor/6000.5.9f1/` |
| 모듈 | **WebGL** 설치됨 (`modules.json` `webgl: selected`). Mac Standalone 은 에디터 기본 |
| 라이선스 | **Unity Personal** 활성 (`unity license` → `Unity Personal  Assigned`) |
| CLI | 공식 `unity` CLI `1.0.0-beta.5` (`~/.unity/bin/unity`) — `build --target WebGL --execute-method` · `run --command` · `test --mode EditMode` · `templates` |
| 카탈로그 | `EngineType.UNITY_WEBGL` 이미 존재 (`game/domain/.../EngineType.kt`) — 시드에 새 enum 불필요 |

→ **에이전트가 에디터 GUI 없이 C# 작성 → 배치 빌드 → 산출물 배치까지 할 수 있다.** 클린룸 세션 모델이
유지된다 (준비 문서 §3 의 "클린룸 모델이 안 맞는다" 는 CLI 가 없던 시점의 판단).

## 1. 결정 사항

### D1. 소스 위치 — **결정 필요** (기본값 제안 포함)

`1989v/msa` 는 **PUBLIC** 이고 게임 산출물 서브모듈 `1989v/games` 는 private 이다. 준비 문서 §4 의
"Unity 프로젝트는 msa 본체" 는 게임 소스 원문이 공개 레포에 올라간다는 뜻이라 게임 자산을 private 으로
둔 기존 결정과 어긋난다.

| 안 | 배치 | 판단 |
|---|---|---|
| **A (제안)** | 공용 브릿지·템플릿은 msa 본체(공개) `unity/` · 게임 프로젝트는 **새 private 서브모듈** `1989v/unity-games` → `unity/games/<slug>/` | 하네스는 포트폴리오 가치가 있어 공개, 게임 원문은 비공개. 서브모듈 규칙(먼저 푸시 → 포인터 범프)은 games 와 동일 |
| B | 전부 msa 본체 `unity/<slug>/` (준비 문서 원안) | 게임 소스 공개. 캔버스 게임을 private 으로 뺀 이유와 충돌 |
| C | 전부 `1989v/games` 서브모듈 안 (`portal-fe/public/games/_unity/`) | **불가** — `public/` 은 그대로 서빙·Docker 이미지에 들어간다. 소스가 배포된다 |

**A 로 진행한다.** 사용자가 달리 정하면 §3 의 경로만 바뀌고 나머지는 그대로다.

### D2. 공용 브릿지는 **로컬 UPM 패키지 하나**로 — 게임마다 복사하지 않는다

플랫폼 계약(`.jslib` + C# 파사드 + 빌드 스크립트)은 지식이 하나다. 게임 N개에 복사하면 계약이 바뀔 때
N곳을 고친다. `unity/packages/com.kgd.webgame/` 로 두고 각 프로젝트의 `Packages/manifest.json` 이
`"com.kgd.webgame": "file:../../../packages/com.kgd.webgame"` 로 참조한다 (서브모듈 경계는 파일
경로라 문제없다). 예외: **WebGL 템플릿(`Assets/WebGLTemplates/Kgd/`)은 패키지에 못 넣는다** (Unity 제약) —
스캐폴드 스크립트가 복사하고, 린트가 원본과의 차이를 잡는다.

### D3. 클린룸 기본형 = **코드 우선 씬**

씬은 `Main.unity` 하나, 오브젝트 `Bootstrap` 하나에 `GameEntry` 가 붙어 있고 **나머지는 전부 C# 이
런타임에 만든다** (프리미티브·절차 메시·머티리얼·uGUI). 에디터에서 손으로 놓은 프리팹/씬 상태가
없어야 에이전트가 파일만 보고 재현·검증할 수 있다. 에디터 GUI 로 만든 자산은 금지가 아니라
**클린룸 세션이 쓸 수 없는 것**이다 — 쓰려면 이유를 `DESIGN.md` 에 적는다.

### D4. 입력은 `KgdInput` 만 읽는다 — `UnityEngine.Input` / InputSystem 직접 호출 금지

가상패드(`lib/touch.js`)는 `window.GameTouch.axis()/pressed()` 를 항상 제공한다(no-op 스텁 포함).
브릿지가 매 프레임 이걸 `.jslib` 로 읽어 키보드 입력과 **합친다** — 합성 KeyboardEvent 가 Unity 에
먹히는지(준비 문서 [미검증] 2번)에 **의존하지 않는 설계**다. 먹히면 덤이고 안 먹혀도 동작한다.
게임 코드가 Unity 입력을 직접 읽으면 이 합류점을 우회해 모바일에서 조용히 안 움직인다.

### D5. 세이브는 `localStorage` 명시 기록 — `PlayerPrefs` 금지

`platform.js` 의 서버 동기화는 `localStorage.setItem` 가로채기다. WebGL `PlayerPrefs` 는 IndexedDB 라
안 걸린다. `KgdSave.Set/Get` 이 `.jslib` 로 localStorage 를 직접 쓰고, 키는 템플릿 index.html 의
`PlatformAdapter.init({ saveKeys })` 에 선언한다. C# 소스에 `PlayerPrefs` 가 있으면 린트 경고.

### D6. 압축은 **Gzip** + nginx 명시 헤더, 압축 폴백(Decompression Fallback) **끔**

nginx 이미지(`nginx:1.27-alpine`)에 brotli 모듈이 없다. Unity Gzip 빌드는 `*.gz` 파일을 직접 요청하므로
nginx 가 `Content-Encoding: gzip` 과 원래 MIME(`application/wasm` 등)을 붙여야 한다. 폴백을 켜면
서버 설정이 틀려도 JS 가 풀어 주므로 **설정 오류가 숨는다** — 파일럿에서 nginx 를 검증한 뒤 끈 채로 둔다.

### D7. 산출물 파일명은 **해시** (`nameFilesAsHashes`) + `immutable`

현행 nginx 는 `/games/**.js` 를 `no-cache` 로 둔다 (배포 후 구버전 방지). 10MB 급 `framework.js`·`.wasm` 을
매번 재검증하면 로딩이 느려진다. 파일명에 해시가 있으면 `Build/` 만 `immutable` 로 빼고 `index.html`(no-cache)
이 새 이름을 가리킨다. 캔버스 게임 규칙은 건드리지 않는다.

### D8. DPR 상한 2

Unity 로더 기본값은 `window.devicePixelRatio` 를 그대로 써 iPhone 에서 3× 픽셀을 그린다. 템플릿이
`config.devicePixelRatio = Math.min(devicePixelRatio, 2)` 로 고정한다. 파일럿의 fps 실측 항목.

### D9. UI 는 uGUI + Canvas Scaler(Scale With Screen Size, 기준 **390×844**)

G5-2 의 하한(터치 44 / 조작 28 / 라벨 11 / 구분 16 CSS px)이 **UI 단위 그대로** 적용되게 기준 해상도를
기준 기기와 맞춘다. 한글은 OFL TTF 번들 + TMP 동적 아틀라스 (WebGL 에는 시스템 폰트가 없다 — G2).

### D10. CI 는 Unity 를 빌드하지 않는다 (준비 문서 §3 유지)

로컬 `unity build` → 산출물을 `1989v/games` 에 커밋. 이미지 빌드는 산출물을 정적 파일로만 본다.

## 2. 산출물 목록

| 종류 | 경로 | 내용 |
|---|---|---|
| ADR | `docs/adr/ADR-0084-unity-web-game-pipeline.md` | D1~D10 + 서빙 경로 변경(nginx/Dockerfile) 근거 |
| 표준 | `docs/standards/unity-game-pipeline.md` (재작성) | 준비 문서 → 정식. [미검증] 을 실측값으로 치환, 마스터 프롬프트·통합 절차 추가 |
| 브릿지 패키지 | `unity/packages/com.kgd.webgame/` | `package.json` · `Runtime/{KgdBridge,KgdInput,KgdPlatform,KgdSave,KgdDevice}.cs` · `Runtime/Plugins/WebGL/kgd.jslib` · `Editor/{WebBuild,Scaffold,FontBake}.cs` |
| WebGL 템플릿 | `unity/template/Assets/WebGLTemplates/Kgd/index.html` (+`TemplateData/`) | 우리 규약 index.html — viewport · lib 로드 순서 · `data-fit="0"` · 조작 방식 선언 · OG · DPR 상한 |
| 템플릿 프로젝트 | `unity/template/` | `Assets/Scenes/Main.unity` · `Assets/Scripts/GameEntry.cs` · `Assets/Fonts/` · `Packages/manifest.json` · `ProjectSettings/` · `.gitignore` · `DESIGN.md` 뼈대 · `CREDITS.md` |
| 스크립트 | `scripts/unity-new-game.py <slug>` | 프로젝트 생성 → 템플릿 복사·치환 → TMP 필수 리소스 추출 → 씬 생성 |
| 스크립트 | `scripts/serve-games.py` | 로컬 서빙 — `.gz` 에 `Content-Encoding`·원래 MIME 을 붙인다(운영 nginx 와 같은 규칙). 이게 없으면 로딩 0% 에서 멈춘다 |
| 스크립트 | `scripts/unity-build-web.sh <slug>` | `unity build … --target WebGL --execute-method Kgd.Editor.WebBuild.Build -o portal-fe/public/games/<slug>` + 로그 · 용량표 · 린트 |
| 린트 확장 | `scripts/lint-game-mobile.py` | Unity 게임 감지(`Build/` + `createUnityInstance`) 시 U1~U5 추가 (§4) |
| 훅 | `.claude/hooks/unity-game-check.sh` | `unity/**/Assets/**/*.cs` 수정 시 `PlayerPrefs`·`UnityEngine.Input` 직접 사용을 알림 (막지 않는다). `settings.local.json` PostToolUse 에 등록 |
| 스킬 | `.claude/skills/unity-game/SKILL.md` | `game-cleanroom` 과 같은 얇은 오케스트레이터. 표준 문서의 마스터 프롬프트를 로드해 실행 |
| 서빙 | `portal-fe/nginx.conf` · `portal-fe/Dockerfile` | `.gz` 헤더 · `wasm` MIME · `Build/` immutable · esbuild minify 에서 `Build/` 제외 |
| 문서 정합 | `CLAUDE.md` Navigation 행 · `game-cleanroom-pipeline.md` §8 상태 · `game/CLAUDE.md` 정적 자산 표 · `k8s/CLAUDE.md` 없음(CI 미관여) | — |
| 서브모듈 | `.gitmodules` + `unity/games` (D1-A 확정 시) | `1989v/unity-games` private |

## 3. 디렉터리 배치 (D1-A 기준)

```
msa/
  unity/
    packages/com.kgd.webgame/          ← 공용 브릿지 (msa 본체, 공개)
      package.json
      Runtime/  KgdPlatform.cs KgdInput.cs KgdHud.cs KgdSave.cs  Kgd.Runtime.asmdef
      Runtime/Plugins/WebGL/kgd.jslib
      Editor/   WebBuild.cs  Kgd.Editor.asmdef
    template/                          ← 템플릿 프로젝트 = 파일럿 (msa 본체, 공개)
      Assets/Scenes/Main.unity
      Assets/Scripts/GameEntry.cs
      Assets/WebGLTemplates/Kgd/index.html · TemplateData/
      Assets/Fonts/<OFL 한글>.ttf
      Packages/manifest.json           ← "com.kgd.webgame": "file:../../packages/com.kgd.webgame"
      ProjectSettings/                 ← WebGL: Gzip · nameFilesAsHashes · Strip High · IL2CPP Faster(smaller)
      .gitignore                       ← Library/ Temp/ Logs/ obj/ Build/ UserSettings/ *.csproj *.sln
      DESIGN.md · CREDITS.md
    games/                             ← private 서브모듈 1989v/unity-games
      <slug>/                          ← 템플릿 복사본 (manifest 는 ../../../packages/...)
  portal-fe/public/games/<slug>/       ← WebGL 빌드 산출물만 (1989v/games 서브모듈)
      index.html                       ← 템플릿에서 생성됨
      Build/<hash>.{loader.js,framework.js.gz,data.gz,wasm.gz}
      TemplateData/
```

## 4. 브릿지 계약 (플랫폼 ↔ Unity)

### 4.1 `.jslib` (`kgd.jslib`) — JS 전역을 감싸는 얇은 층. 로직을 넣지 않는다

| 함수 | 호출 대상 | 비고 |
|---|---|---|
| `KgdSubmitScore(score, detail, board)` | `PlatformAdapter.runEnd({score, detail, board\|\|null})` | `detail` 은 문자열. 없으면 조용히 반환 — 캔버스 규약과 같다 |
| `KgdHudExpanded()` → 0/1 | `GameHud.expanded()` | 없으면 1 |
| `KgdHudSubscribe(objName)` | `GameHud.on('change')` → `SendMessage(objName,'OnHudChanged',…)` | Bootstrap 이 구독 |
| `KgdSaveSet(key, val)` / `KgdSaveGet(key)` → string | `localStorage` | `try/catch` — 프라이빗 모드 대비 |
| `KgdTouchAxis(outPtr)` | `GameTouch.axis()` → `{x, y, mag}` | 매 프레임. 스텁이면 0 |
| `KgdTouchPressed(codeStr)` → 0/1 | `GameTouch.pressed().includes(code)` | 액션 5개 이하 |
| `KgdIsCoarsePointer()` → 0/1 | `matchMedia('(pointer: coarse)')` | HUD 기본 접힘 판정과 같은 기준 |
| `KgdLayout(outPtr)` | `GameTouch.on('layout')` 마지막 값 (`padH`, `landscape`) | 세로에서 패드 밴드 높이만큼 캔버스가 줄어든 것을 게임이 안다 |

### 4.2 C# 파사드 (`Kgd.Runtime`)

```csharp
KgdPlatform.SubmitScore(int score, string detail, string board = null);
KgdHud.Expanded; KgdHud.Changed += ...;
KgdSave.Set(string key, string json); KgdSave.Get(string key);
KgdInput.Move            // Vector2 — 키보드(Arrow/WASD) ∪ GameTouch.axis
KgdInput.Action(int n)   // 1~5 — 키보드(C/X/Z/A/S 표준 슬롯) ∪ GameTouch.pressed
KgdInput.Pause           // Escape ∪ data-pause 버튼
KgdDevice.IsCoarse; KgdDevice.IsLandscape;
```
에디터/스탠드얼론에서는 `#if !UNITY_WEBGL || UNITY_EDITOR` 로 키보드만 읽는 스텁 — PlayMode 테스트가 돈다.

### 4.3 템플릿 `index.html` 규약 (린트 U1 대상)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- mobile: virtual-pad -->           <!-- 또는 native-touch — 스캐폴드 인자로 정한다 -->
<script src="../lib/hud.js"></script>
<script src="../lib/rank.js"></script>  <!-- platform.js 앞 — 순서가 규칙 -->
<script src="../lib/platform.js"></script>
<script>PlatformAdapter.init({ slug: '{{SLUG}}', title: '{{TITLE}}', saveKeys: ['{{SLUG}}.save.v1'] });</script>
<script src="../lib/touch.js" data-fit="0" data-actions="KeyC:⚔:공격,KeyX:🦘:점프"></script>
<!-- Unity 로더는 마지막. config.devicePixelRatio = Math.min(devicePixelRatio, 2) -->
```
캔버스 레이아웃은 `game-input-standard.md` §모바일 화면 배치 그대로 — 세로: 폭 100%·상단 정렬·
하단 `--vt-pad-h` 만큼 비움 / 가로: 높이 100%. Unity 는 캔버스 CSS 크기에 맞춰 렌더 타깃을
바꾸므로 레터박스가 없다 — **G5-2 는 uGUI 단위로 잰다** (D9).

## 5. 하네스 — 정적 검사 U1~U5

`scripts/lint-game-mobile.py` 에 Unity 게임 분기를 추가한다 (`Build/` 존재 + `createUnityInstance`).
기존 F1/F2/W1~W5 는 그대로 적용되고, 아래가 더해진다:

| 코드 | 검사 | 근거 |
|---|---|---|
| U1 | `touch.js` 에 `data-fit="0"` 없음 → **F** | Unity 가 캔버스 크기를 직접 관리한다. 없으면 `fitCanvas` 와 싸운다 |
| U2 | `Build/` 파일명이 해시가 아님 → W | D7 — immutable 캐시 규칙의 전제 |
| U3 | `Build/` 총 용량 > **15MB** → **F** | 준비 문서 §6 예산. 파일럿 후 값 조정 가능 |
| U4 | `.gz` 가 없거나 폴백 표식(`decompressionFallback`)이 있음 → W | D6 |
| U5 | 로더 설정에 `devicePixelRatio` 상한이 없음 → W | D8 |

소스 쪽(`unity/games/<slug>/Assets/**/*.cs`)은 훅이 본다: `PlayerPrefs.` · `UnityEngine.Input` /
`InputSystem` 직접 참조 → 알림. `unity test --mode EditMode` 는 브릿지 패키지의 파사드 스텁 테스트만.

## 5.4 벤치마크의 **규모**는 그래픽과 별개로 판정한다 (2026-08-28 — 반복 지적)

단일 원본은 `game-cleanroom-pipeline.md` 전역 가드레일 **G6** 이다. 여기서 반복하지 않는다.
요지만: 벤치마크작의 **맵 범위 · 해상도 · 플레이타임 · 진행 깊이** 넷을 수치로 조사해 슬롯으로
싣고 완성 판정에 넣는다. 유니티 라인에서 특히 중요한 이유가 둘 있다:

- **플레이타임이 시간 단위면 이어하기가 필수**다. 그러면 런 상태 전체를 `KgdSave` 로 직렬화해야 하고,
  그 키를 index.html 의 `PlatformAdapter.init({ saveKeys })` 에도 넣어야 서버 동기화가 된다.
- **맵이 커지면 청크 스트리밍이 전제**다. Unity 는 씬을 통째로 만들면 부팅에서 죽는다.
  그리고 **이 규모가 곧 유니티를 쓰는 근거**다 — 88×88 짜리 맵은 캔버스로도 되고,
  그 경우 wasm 5.3MB 를 낼 이유가 없다(사용자 지적, 2026-08-28).

## 5.5 화면 방향은 **시안 → 컨펌 → 구현** 순서다 (2026-08-27 신설 — 사용자 지시)

> 코드부터 쓰고 나중에 색을 고치는 순서로 가면, 이미 만든 지오메트리·조명·UI 에 맞춰
> 색만 바꾸게 된다. 그 순서로는 화면 방향을 바꿀 수 없다 — 방향이 지오메트리와 조명을 정한다.

**절차 (유니티 신작 공통, 마스터 프롬프트에 포함)**

1. 플레이 가능한 최소 장면이 서면 **그 장면 그대로** 화면 방향 후보 **2~3개**를 만든다.
   후보는 말이 아니라 **같은 자리·같은 구도에서 찍은 실제 엔진 스크린샷**이어야 한다 —
   무드보드나 팔레트 표는 엔진에서 어떻게 보일지 말해 주지 않는다.
2. 후보가 달라야 하는 축: **키 라이트 색·시간대 · 그림자 색 · 채도 · 블룸 세기 · 안개 거리 · 비네트**.
   같은 그림에 밝기만 다른 것은 후보가 아니다.
3. 세로·가로 각 한 장씩 찍어 **나란히** 보여 주고 **사용자 확정을 받는다.**
4. 확정된 방향 하나만 남기고 나머지 프리셋은 **지운다.** 골라 둔 채로 두면 다음 사람이
   무엇이 정답인지 모른다.
5. 확정 뒤에 아트 밀도(디테일·프롭·이펙트)를 그 방향에 맞춰 올린다.

**후처리는 선택이 아니라 기본이다.** 로우폴리 도형은 블룸·색분리(그림자 청록 / 하이라이트 호박)·
비네트·그레인 없이는 "도형 모음"으로 보인다. MSAA 도 마찬가지다 — 각진 형태는 계단이 그대로 읽힌다.

---

## 6. 마스터 프롬프트 — 캔버스 프롬프트와의 **차분**만 적는다

표준 문서에는 전문을 싣되, 캔버스 마스터 프롬프트를 복제하지 않고 **"캔버스 프롬프트 ★품질 게이트·
G5·IP·검증 프로토콜을 그대로 상속한다"** 고 선언한 뒤 아래 차분만 둔다 (두 문서가 갈라지지 않게):

- **화면 방향 먼저**: §5.5 — 최소 장면이 서면 후보 2~3개를 엔진 스크린샷으로 만들어 **확정을 받고**
  그다음 아트를 올린다. 후처리(블룸·색분리·비네트·그레인)와 MSAA 는 기본값으로 켜고 시작한다
- **기술 제약**: Unity 6 (`6000.5.x`) · **Built-in RP**(URP 는 WebGL 전송량을 몇 MB 늘린다) ·
  uGUI(+TMP 정적 한글 아틀라스) · 씬 1개 코드 우선(D3) ·
  입력은 `KgdInput` 만(D4) · 세이브는 `KgdSave` 만(D5) · 랭킹 UI 만들지 않음(캔버스와 동일)
- **빌드**: `scripts/unity-build-web.sh <slug>` 만 쓴다. Development Build 금지. 산출물 손수정 금지
- **예산**: 전송 ≤15MB · 첫 화면 ≤5초(4G) · 모바일 ≥45fps · iOS Safari 크래시 0 — 미달이면 완성 아님
- **검증**: 캔버스와 같은 CDP 두 방향 실측 + **로더 진행률 100% 도달·콘솔 에러 0**. 자동 플레이는
  `KgdInput` 가 읽는 실제 KeyboardEvent 로. 추가로 `fetch` 가로채기로 `POST …/scores` 본문 확인
- **클린룸 하드 룰 추가**: 다른 `unity/games/*` 폴더 열람 금지. 브릿지 패키지의 **공개 API(4.2)만** 안다 —
  `.jslib` 내부와 `lib/` 는 못 본다
- **산출물**: `unity/games/<slug>/` (소스) + `portal-fe/public/games/<slug>/` (빌드) + `DESIGN.md` 첫 절에
  **왜 유니티인가**(`game-cleanroom-pipeline.md` §8 판정) 한 줄

스킬 슬롯은 `game-cleanroom` 과 같고 `⟨조작 방식⟩`(virtual-pad | native-touch, 스캐폴드 인자) 하나가 는다.

## 7. 단계

각 단계 = 한 커밋 묶음. 여러 세션이 워킹트리를 공유하므로 `git add` 는 경로로 좁힌다.

### P0 — 결정 확정 + ADR (반나절)
- D1 확정 (사용자). A 면 `1989v/unity-games` private 레포 생성 → `.gitmodules` 추가
- `ADR-0084` 작성. 검증: `docs/adr/` 번호 연속, `adr-check.sh` 통과

### P1 — 브릿지 패키지 + WebGL 템플릿 (1일)
- `unity/packages/com.kgd.webgame/` 전부 (§4.1·4.2) · `Editor/WebBuild.cs`
  (`BuildPlayerOptions` — target WebGL · `PlayerSettings.WebGL.compressionFormat = Gzip` ·
  `nameFilesAsHashes = true` · `decompressionFallback = false` · `ManagedStrippingLevel.High` ·
  `-buildOutput` 인자 존중)
- `unity/template/` 프로젝트: Main 씬 + `GameEntry` + 템플릿 index.html + 한글 TTF(OFL, CREDITS)
- 검증: `unity test unity/template --mode EditMode` 통과 줄

### P2 — 서빙 경로 (반나절)
- `nginx.conf`: `location ~ ^/games/[a-z0-9-]+/Build/` — `.gz` 에 `Content-Encoding: gzip` + `gzip off` +
  원래 MIME(`types { application/wasm wasm; }` · `.js.gz`→javascript · `.data.gz`→octet-stream) ·
  `Cache-Control: public, immutable, max-age=1y` (해시 파일명 전제)
- `Dockerfile`: esbuild minify `find` 에 `-not -path '*/Build/*'` (Unity 로더·프레임워크는 이미 minified 고
  10MB 재처리는 빌드 시간만 먹는다)
- 검증: 로컬 nginx 컨테이너로 `curl -I` 헤더 4종 (`content-encoding`·`content-type`·`cache-control`·`x-robots-tag`)

### P2.5 — 화면 방향 시안 (반나절) — §5.5

### P3 — 파일럿 빌드 + 실측 (1일) — **여기서 표준이 결정된다**
- `scripts/unity-build-web.sh template` → `portal-fe/public/games/unity-pilot/` (임시 slug, 배포 안 함)
- 실측 7항목: ① 총 전송량(gz 후) ② 첫 화면까지(4G 스로틀) ③ 모바일 fps(실기 iPhone·안드) ④ G5 두 방향 CDP
  ⑤ `runEnd` → `POST /scores` 본문 ⑥ `KgdSave` → 서버 세이브 동기화 ⑦ 가상패드 → `KgdInput.Move` 반응
- 부수 확인: 합성 KeyboardEvent 가 Unity 에 먹히는지(기록만) · DPR 2 vs 3 fps 차 · TMP 한글 렌더 · iOS 메모리
- 결과를 `unity-game-pipeline.md` 의 [미검증] 자리에 **실측값으로** 적는다. 예산 미달이면 이 플랜은
  여기서 멈추고 §8 에 이유를 남긴다 (캔버스로 복귀 — 준비 문서 §8-8 규칙)

### P4 — 하네스 (반나절)
- `lint-game-mobile.py` U1~U5 · `unity-game-check.sh` 훅 + `settings.local.json` 등록 ·
  `unity-new-game.sh` · `unity-build-web.sh` 정리(로그·용량표·린트 호출)
- 검증: `scripts/lint-game-mobile.py unity-pilot --strict` 통과 줄 · 훅 알림 1회 재현

### P5 — 표준 문서 · 스킬 · 정합 (반나절)
- `unity-game-pipeline.md` 재작성(§6 마스터 프롬프트 포함) · `.claude/skills/unity-game/SKILL.md` ·
  `CLAUDE.md` Navigation 행("파일럿 전" 문구 제거) · `game-cleanroom-pipeline.md` §8 상태 갱신 ·
  `game/CLAUDE.md` 정적 자산 표에 Unity 행 형식
- 검증: `/hns:doctor` 또는 doc-index 스캔에서 새 문서 dangling 0

### P6 — 첫 실전 게임 (별도 세션, 이 플랜 밖)
- `/unity-game <컨셉> --control virtual-pad` 로 클린룸 세션 1개. 통합 절차는 캔버스와 동일하되
  시드 `engine_type='UNITY_WEBGL'`, `entry_url='/games/<slug>/index.html'`. `unity-pilot` 산출물은 삭제

## 7.4 첫 실전작 실측 (2026-08-28 `archer-outbreak` — 「궁수 키우기」)

파일럿과 첫 게임을 하나로 합쳤다. 준비 문서의 [미검증] 네 항목이 전부 실측값으로 바뀐다.

| 항목 | 상한 | 실측 | 판정 |
|---|---|---|---|
| 전송량(gzip) | 15MB | **7.6MB** (wasm 5.3 · data 2.2 · framework 0.07 · loader 0.03) | 통과 |
| 첫 화면까지 | 5초 | 데스크톱 로컬 즉시 · **4G 실측 미실시** | 보류 |
| fps | 45 | **120** (데스크톱 1200×630 · 좀비 12·소품 200+) · **실기 미실시** | 보류 |
| G5 두 방향 | 필수 | 세로 390×608(밴드 236) · 가로 844×390 · **궁수 29.7 CSS px** · 좀비 25.8 | 통과 |
| 정적 검사 | 경고 0 | `lint-game-mobile.py --strict` 통과 | 통과 |
| nginx 서빙 | 필수 | **실제 `nginx:1.27-alpine` 컨테이너로 확인** — wasm/js/data 각각 올바른 MIME + `Content-Encoding: gzip` + immutable | 통과 |

**보류 두 항목(실기 fps·4G 첫 로딩)이 남아 있어 카탈로그 status 를 `BETA` 로 넣었다.**
실기에서 재고 나면 `PUBLISHED` 로 올리는 UPDATE 마이그레이션을 새 버전으로 낸다.

### 이 게임을 만들며 드러난 함정 (다음 게임이 같은 데서 안 막히게)

| 증상 | 원인 | 대응 |
|---|---|---|
| 화면이 통째로 마젠타 | `Shader.Find` 대상 셰이더는 어떤 에셋도 참조하지 않아 스트리핑된다 | 셰이더를 `Assets/Resources/` 에 둔다 |
| `CapsuleCollider` 클래스 없음 | 엔진 코드 스트리핑이 Physics 모듈을 뺀다 | Unity 물리를 안 쓴다(자체 원형 충돌 + 균일 격자) |
| 한글이 전부 네모 | WebGL 에 시스템 폰트가 없다 | OFL TTF → **정적 SDF 아틀라스**, 글자는 소스 문자열 리터럴에서 추출 |
| 앞뒤로 한 발도 안 나감 | `KgdInput.Move`(Vector2) → Vector3 **암시적 변환이 앞뒤를 위아래로** 보낸다 | `KgdInput.MovePlanar` 를 쓴다(브릿지에 추가) |
| 창백한 거대 형체가 화면을 덮음 | 모델 크기 정규화가 한 번만 재고 실패하면 원본 배율로 남는다 | `Fit()` 을 2패스로 — 재고 다시 확인 |
| 세로에서 가상패드가 게임 위에 겹침 | `lib/touch.js` 는 fit 을 켠 게임에만 하단 띠를 만든다. Unity 는 fit 을 꺼야 한다 | 템플릿이 세로에서 직접 띠를 확보(비율 0.28, 출처는 `game-input-standard.md`) |
| 로딩 0% 에서 멈춤 | `.gz` 에 `Content-Encoding`·원래 MIME 이 없다 | nginx 에 Unity 전용 location 4개. `types { }` 로 확장자 매핑을 비워야 `default_type` 이 먹는다 |
| 시작 30초에 아무것도 못 하고 죽음 | 배회 개체가 기지 안까지 걸어와 시작하자마자 포위 | 배회 목적지를 기지 밖으로 · 어그로 반경 축소 · 피격 후 0.45초 무적 |

## 7.5 진행 중 확정된 것 (2026-08-27 첫 파일럿 `archer-outbreak`)

| 항목 | 값 | 근거 |
|---|---|---|
| 첫 빌드 전송량 | **6.6MB** (wasm 5.0 · data 1.5) — 상한 15MB 통과 | 빈 씬 + TMP |
| 게임 본편 전송량 | **7.0MB** | 코드 5천 줄 · 절차 생성 아트·오디오 |
| 렌더 파이프라인 | **Built-in RP** (URP 미도입) | 전송량. 후처리는 `OnRenderImage` 커스텀 |
| 물리 | **Unity 물리 미사용** — 자체 원형 충돌 + 균일 격자 | 엔진 코드 스트리핑이 Physics 모듈을 뺀다(`CapsuleCollider` 클래스 없음). 좀비 100+ 에도 이쪽이 맞다 |
| 셰이더 | `Assets/Resources/` 에 둔다 | `Shader.Find` 대상은 어떤 에셋도 참조하지 않아 통째로 스트리핑된다 — **그 결과가 마젠타 화면**이다 |
| 한글 폰트 | Gothic A1 Bold(OFL) → **정적 SDF 아틀라스**, 글자는 소스 문자열 리터럴에서 추출 | 폰트 파일 2.3MB 를 통째로 넣으면 안 쓰는 2,350 자가 전송량에 들어간다 |
| TMP 필수 리소스 | `com.unity.ugui` 안 `.unitypackage` 를 **직접 풀어 넣는다** | 이 버전에는 `TMP_PackageResourceImporter` 가 주석 처리돼 있다 |
| 메뉴 ↔ 가상패드 | `KgdPlatform.SetMenuOpen()` → 템플릿의 빈 `.panel` 토글 | Unity 캔버스 안 패널은 DOM 에 없어 `lib/touch.js` 규약이 닿지 않는다 |

## 8. 중단 조건 (P3 에서 판정)

| 항목 | 상한 | 미달 시 |
|---|---|---|
| 전송량 | 15MB | 스트리핑·텍스처·패키지 제거 1회 재시도 후에도 넘으면 중단 |
| 첫 화면 | 5초 (4G) | 위와 같음 |
| 모바일 fps | 45 | DPR 상한·URP 품질 하향 1회 재시도 후 중단 |
| iOS Safari | 크래시 0 | 초기 메모리 축소 1회 재시도 후 중단 |

중단하면 `unity-game-pipeline.md` §8 에 실측값과 이유를 적고 캔버스 라인으로 복귀한다.
"다음 사람이 다시 시도하지 않게" 가 목적이므로 실측 수치를 반드시 남긴다.

## 9. 이 플랜이 건드리지 않는 것

- 캔버스 게임 70종·`lib/*.js`·기존 nginx 규칙 — Unity 전용 `location` 만 추가한다
- CI(`images.yml`) — Unity 빌드를 넣지 않는다 (D10)
- 카탈로그 스키마·API — `UNITY_WEBGL` 이 이미 있다
- 프리렌더/SEO — 게임 상세 페이지는 캔버스와 같은 경로를 탄다

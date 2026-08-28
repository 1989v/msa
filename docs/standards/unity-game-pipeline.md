<!-- source: portal-fe/nginx.conf -->

# 유니티 게임 제작 파이프라인 (WebGL) — 준비 문서

> [!important] **이 문서는 아직 검증되지 않았다.**
> 이 환경에 **Unity Editor 가 설치돼 있지 않아**(`/Applications/Unity*` 없음, `unity` CLI 없음)
> 파일럿을 만들 수 없었다. 아래에서 **[확인]** 표시가 붙은 것만 공식 문서·검색으로 확인한
> 사실이고, 나머지는 **이 레포의 구조에서 도출한 설계 의도**다. 파일럿이 통과하기 전에는
> 유니티가 정식 선택지가 아니다 (`game-cleanroom-pipeline.md` 기술 도입 게이트 §8).
>
> 파일럿을 돌리면 **이 문서의 [미검증] 항목을 실측값으로 바꾸는 것**이 첫 임무다.

캔버스 게임의 단일 원본은 `docs/standards/game-cleanroom-pipeline.md` 다.
이 문서는 **그 파이프라인이 감당하지 못하는 장르**를 위한 별도 라인이고, 전역 가드레일
G1~G5 와 품질 게이트는 **그대로 상속한다** — 엔진이 바뀌어도 모바일이 1순위인 것은 안 바뀐다.

---

## 0. 언제 유니티인가 — 먼저 이 표로 판정한다

| 장르 | 선택 | 근거 |
|---|---|---|
| 팝콘 아케이드 · 2D 액션 · 퍼즐 · 보드 · 파티 | **캔버스** | 지금까지의 70종이 전부 여기. 빌드 스텝 0, 드롭인 배포 |
| **3D 지향 · 물리 헤비 · 대규모 씬 · 캐릭터 애니메이션 다수** | **유니티 검토** | 캔버스로 만들면 렌더러·물리·씬 그래프를 매번 다시 짓는다. G4 가 금지한 "어중간한 3D" 의 진짜 원인이 이것이다 |

**파일럿 결과 (2026-08-28, 「궁수 키우기」)** — 판정 기준을 좁힌다.

유니티가 값을 하는 것은 **골격 애니메이션이 붙은 무리 + 스트리밍이 필요한 큰 3D 맵** 둘이
동시에 필요할 때다. 이 게임은 600×600 지도에 구역 29곳, 동시 생존 최대 240마리가 각자
걷는 클립을 돌린다 — 캔버스로 하면 스킨 계산과 씬 그래프를 직접 짜야 한다.

**반대로, 이 둘이 없으면 캔버스가 싸고 빠르다.** 3D 로 보이는 것만으로는 부족하다.
파일럿에서 "유니티인데 캔버스로도 되겠다" 는 지적을 받았고, 그때 화면에 없던 것이
정확히 이 둘이었다(애니메이션이 버그로 안 돌고 있었고 무리도 적었다).

**판정을 문서에 남긴다.** 어느 쪽을 골랐고 왜인지 그 게임의 `DESIGN.md` 첫 절에 적는다 —
안 적으면 다음 사람이 같은 판정을 처음부터 다시 한다.

> **캔버스로 충분한 것을 유니티로 만들지 마라.** 10~50MB 를 내려받게 하고 빌드 스텝을
> 들이는 대가는 3D 가 실제로 필요할 때만 값을 한다.

---

## 1. 무료 조건 [확인 — 2026-08 기준]

| 항목 | 값 | 출처 |
|---|---|---|
| Unity Personal 무료 상한 | **연매출·조달자금 20만 USD 미만** (기존 10만에서 상향) | Unity 공식 |
| Runtime Fee | **폐지됨** (2024-09) — 설치 수 과금 없음 | Unity 공식 |
| "Made with Unity" 스플래시 | **Unity 6 부터 Personal 도 끌 수 있다** | Unity 공식 |
| Unity Pro 가격 | 2026-01-12 부터 5% 인상 — **Personal 에는 해당 없음** | Unity 공식 |

- 이 플랫폼은 광고 수익 모델이고 현재 저 선을 한참 아래로 통과한다.
- **넘어설 조짐이 보이면 그때 다시 판단한다** — 넘는 순간 라이선스가 유료로 바뀐다는 것을
  알고 쓴다. 이 절의 숫자는 **바뀔 수 있으므로 파일럿 때 다시 확인**한다.

---

## 2. 브라우저 지원 [확인]

| 항목 | 값 |
|---|---|
| Unity Web 지원 모바일 브라우저 | **iOS Safari 15+**, **Android Chrome 58+** |
| 기본 렌더 백엔드 | **WebGL2** |
| WebGPU | Unity 6 에 있으나 **실험 단계** — 기본값 아님 |

- Unity 공식 문서는 모바일 브라우저를 **지원 대상으로 명시**한다("The Unity Web platform
  supports some mobile browsers"). "모바일 비권장" 같은 문구는 **없다.**
- 다만 **지원한다는 것과 쓸 만하다는 것은 다르다.** 실기 fps·메모리는 파일럿에서 재야 한다
  (아래 §6). WebGPU 는 지금 쓰지 않는다 — 실험 단계인 백엔드를 1순위 타겟(모바일)에 올리지 않는다.

---

## 3. 이 레포에서 깨지는 것 — 대가를 먼저 안다

캔버스 라인의 근간은 **빌드 스텝 없음**이다. 유니티는 그걸 깬다. 무엇이 어떻게 바뀌는지:

| 지금 | 유니티 도입 시 |
|---|---|
| 게임 폴더를 드롭인하면 끝 | **Unity Editor 로 빌드 → 산출물을 커밋** |
| 클린룸 세션이 코드만 써서 완성 | 에디터 GUI 조작이 필요 — **클린룸 세션 모델이 그대로 안 맞는다** |
| 게임 하나 수백 KB ~ 수 MB | **10~50MB+** [미검증 — 파일럿에서 실측] |
| CI 가 게임을 안 건드린다 | CI 에서 Unity 빌드는 **라이선스 활성화가 필요**해 사실상 불가 → **로컬 빌드 + 산출물 커밋**이 현실적 |
| 첫 로딩 즉시 | 수 초 [미검증] |

> **CI 빌드를 시도하지 마라.** Unity 라이선스 활성화를 GitHub Actions 에 넣으면 시크릿·좌석
> 관리가 붙고, 실패하면 `images.yml` 테스트 게이트처럼 **그 커밋의 다른 서비스까지 막는다**
> (`k8s/CLAUDE.md` 참조). 로컬에서 굽고 산출물만 커밋하는 편이 이 레포의 제약에 맞는다.

---

## 4. 배치 — 같은 레포, 다른 폴더

```
1989v/games (private 서브모듈, portal-fe/public/games/)
  archer-outbreak/          ← WebGL 산출물만. 이게 서빙된다
    index.html
    Build/*.{loader.js,framework.js.gz,data.gz,wasm.gz}
  _src/archer-outbreak/     ← Unity 프로젝트 원본. 서빙되지 않는다
    Assets/  Packages/  ProjectSettings/
msa (공개)
  unity/packages/com.kgd.webgame   ← 브리지 패키지 (재사용 하네스)
  unity/template/WebGLTemplates/Kgd ← index.html 템플릿
  scripts/unity-build-web.sh
```

**게임 하나가 한 레포 안에 있다.** 캔버스 게임 74종과 같은 자리다. 다만 폴더는 갈린다.

> **원본을 산출물 폴더 안에 두지 마라.** 유니티는 빌드할 때 **출력 폴더를 통째로 비운다** —
> 그 안에 프로젝트가 있으면 첫 빌드에서 `Assets/` 째로 지워진다 (2026-08-28 실제로 날렸고
> 커밋에서 되살렸다). 출력 폴더가 프로젝트의 **상위**여도 유니티가 거부한다(SIGABRT).
> 그래서 빌드 스크립트는 임시 폴더에 굽고 산출물만 옮긴다.

- 원본은 서빙되지 않는다. **두 겹으로 막는다** — `portal-fe/.dockerignore` 가
  `public/games/_src` 를 빌드 컨텍스트에서 빼고, nginx 가 `/games/_src` 를 404 로 막는다.
  한 겹만 두면 한쪽이 풀렸을 때 `.fbx`·`.cs` 18MB 가 그대로 공개된다
- `_src/.gitignore` 에 `Library/ Temp/ Logs/ obj/ Build/ UserSettings/ *.csproj *.sln`.
  `Library/` 하나가 284MB 다
- **빌드 산출물을 손으로 고치지 마라.** 다음 빌드가 덮는다. 고칠 것은 `unity/template/` 다

---

## 5. 플랫폼 통합 — 여기가 이 문서의 핵심

우리 공용 레이어는 전부 **평범한 JS 전역**(`GameRank` · `PlatformAdapter` · `GameTouch` ·
`GameHud`)이다. Unity WebGL 에서 이걸 부르려면 **`.jslib` 플러그인**이 필요하다.

`Assets/Plugins/WebGL/platform.jslib`:
```javascript
mergeInto(LibraryManager.library, {
  KgdSubmitScore: function (score, detailPtr, boardPtr) {
    var detail = UTF8ToString(detailPtr), board = UTF8ToString(boardPtr);
    if (window.PlatformAdapter) {
      window.PlatformAdapter.runEnd({ score: score, detail: detail, board: board || null });
    }
  },
  KgdHudExpanded: function () { return (window.GameHud ? window.GameHud.expanded() : true) ? 1 : 0; },
  KgdSaveSet: function (keyPtr, valPtr) {
    // Unity 의 PlayerPrefs 는 WebGL 에서 IndexedDB 다 — platform.js 의 localStorage 가로채기가
    // **보지 못한다.** 서버 세이브를 쓰려면 반드시 localStorage 로 명시 기록해야 한다
    try { localStorage.setItem(UTF8ToString(keyPtr), UTF8ToString(valPtr)); } catch (e) {}
  }
});
```

C# 쪽:
```csharp
[DllImport("__Internal")] private static extern void KgdSubmitScore(int score, string detail, string board);
[DllImport("__Internal")] private static extern int  KgdHudExpanded();
```

### 반드시 짚어야 할 세 가지

1. **세이브는 `PlayerPrefs` 를 쓰면 서버 동기화가 안 된다.**
   `platform.js` 는 `localStorage.setItem` 을 가로채 서버로 밀어 올린다. Unity WebGL 의
   `PlayerPrefs` 는 IndexedDB 에 쓰므로 **그 훅에 안 걸린다.** 세이브 키는 위 `KgdSaveSet`
   처럼 **localStorage 에 명시로** 써야 하고, `PlatformAdapter.init({ saveKeys: [...] })` 에
   그 키를 넣어야 한다. [미검증 — 파일럿에서 실제 동기화 확인]

2. **가상패드는 그냥 될 수도 있다 — 확인이 먼저다.**
   `lib/touch.js` 는 터치를 **실제 KeyboardEvent 로 합성해 `window` 에 디스패치**한다.
   Unity WebGL 도 브라우저 키 이벤트를 듣기 때문에 **손대지 않고 동작할 가능성이 있다.**
   다만 Unity 는 캔버스 포커스·`preventDefault` 처리를 자체적으로 하므로 **된다고 가정하지 마라.**
   파일럿의 첫 검증 항목이 이것이다. 안 되면 `.jslib` 로 입력을 직접 받아 C# 에 넘긴다.
   [미검증]

3. **랭킹 UI 를 유니티 안에 만들지 마라.** 닉네임 입력·순위표는 `lib/rank.js` 가 이미 한다.
   게임 안에 또 만들면 이중 입력이 된다 (`aero-vendetta` 에서 실제로 겪은 것).

### index.html
Unity 의 기본 WebGL 템플릿을 그대로 쓰지 말고, **우리 규약을 넣은 커스텀 템플릿**을 만든다:
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `lib/hud.js` · `lib/rank.js` · `lib/platform.js` 를 **Unity 로더보다 먼저** 싣는다
  (`rank.js` 가 `platform.js` 앞 — 순서가 규칙이다)
- `lib/touch.js` 는 **`data-fit="0"`** 로 싣는다 — Unity 가 캔버스 크기를 직접 관리한다
- `<!-- mobile: virtual-pad -->` 또는 `<!-- mobile: native-touch -->` 선언 (lint W5)
- `scripts/lint-game-mobile.py <slug> --strict` 를 통과시킨다

---

## 6. 용량·성능 예산 — 파일럿이 넘어야 할 선

무료 티어(OCI Ampere A1 + Cloudflare)에서 서빙한다. **넘으면 도입하지 않는다.**

| 항목 | 상한 | 근거 |
|---|---|---|
| 게임 하나 총 전송량 | **≤ 15MB** (압축 후) | 게임 70종 중 하나가 기존 전체보다 커지면 안 된다 |
| 첫 화면까지 | **≤ 5초** (4G 기준) | 이탈률에 직결. 캔버스 게임은 즉시다 |
| 모바일 실기 fps | **≥ 45** (중급 안드로이드 · iPhone) | G5 가 1순위라고 못박은 환경 |
| 메모리 | 크래시 없음 (iOS Safari) | iOS 는 탭 메모리 상한이 낮다 |

**빌드 설정 권장** [미검증 — 파일럿에서 효과 실측]:
- 압축: **Brotli**. 단 **지금 nginx 에 `.br` 처리도 `.wasm` MIME 도 없다** (`portal-fe/nginx.conf`
  확인) — 그대로 올리면 `Content-Encoding` 이 안 붙어 브라우저가 못 푼다.
  **nginx 설정 추가가 선행 조건**이고, 이건 파일럿의 작업 항목이다
- `Managed Stripping Level: High`, `IL2CPP Code Generation: Faster (smaller) builds`
- 텍스처 압축·오디오 압축, 미사용 패키지 제거
- **Development Build 를 끄고** 재본다 — 켠 채 재면 용량·성능이 둘 다 왜곡된다

> **캐시 함정**: `portal-fe/nginx.conf` 는 `/games/**.js` 에 `no-cache` 를 건다(배포 후 구버전
> 방지). Unity 산출물은 파일명이 그대로라 같은 규칙에 걸리는데, **10MB 짜리를 매번 재검증하면
> 로딩이 느려진다.** 파일명에 해시를 넣고 `immutable` 로 빼는 규칙이 필요하다 — 이것도 파일럿 항목이다.

---

## 7. 가드레일은 그대로 상속한다

엔진이 바뀌어도 **G1~G5 는 그대로**다. 특히:

- **G5 모바일 1순위** — 세로 390×844 · 가로 844×390 두 방향 CDP 실측이 완성의 조건.
  Unity 도 결국 `<canvas>` 라 **레터박스 배율을 포함한 CSS px** 로 재는 방법이 똑같다
- **G5-2 CSS px 하한** — 터치 타깃 ≥44 · 조작 대상 ≥28 · 라벨 ≥11 · 구분 대상 ≥16
- **G5-3 조작 방식** — 골라서 근거를 남긴다. 3D 액션이면 가상패드 전제
- **G5-4 정보 패널** — 모바일 기본 접힘. Unity UI 도 `KgdHudExpanded()` 로 같은 신호를 받는다
- **G2 한국어 명명** — 직역투 금지. Unity 기본 UI 문구가 영문으로 새어 나오지 않게 한다
- **G1 카메라 스케일 · 줌 아웃 하한** — 3D 라고 예외가 아니다. 오히려 3D 는 FOV 로 더 쉽게 어긋난다

---

## 8. 파일럿 절차 (착수 시 이 순서)

1. **Unity Hub + Editor(6 LTS) 설치** — 사용자 결정 사항. 이게 없으면 아래를 시작할 수 없다
2. `unity/<slug>/` 에 프로젝트 생성, `.gitignore` 먼저 커밋
3. **가장 작은 게임 하나** — 3D 지만 씬 하나·적 한 종·1분짜리. 재미가 목적이 아니라 측정이 목적이다
4. 커스텀 WebGL 템플릿에 §5 의 규약을 넣고 빌드
5. **네 항목 실측**: ① 총 전송량 ② 첫 화면까지 ③ 모바일 실기 fps ④ G5 두 방향 검수
6. **`.jslib` 세 항목 실측**: 랭킹 제출 도달 · 세이브 서버 동기화 · **가상패드 입력이 먹히는지**
7. `scripts/lint-game-mobile.py <slug> --strict` 통과
8. **넷을 다 넘긴 경우에만** 유니티를 정식 선택지로 편입하고, 이 문서의 [미검증] 을 실측값으로 바꾼다.
   **못 넘기면 캔버스로 되돌리고 왜 못 넘겼는지를 여기에 적는다** — 다음 사람이 다시 시도하지 않게

---

## 9. 실측 함정 — 파일럿에서 실제로 터진 것 (2026-08-28)

전역 함정은 `game-cleanroom-pitfalls.md` 에 있다. 여기는 **유니티에서만 나는 것**이다.
전부 하루를 태운 것들이고, **오류 메시지 없이 조용히 실패한다**는 공통점이 있다.

| 증상 | 진짜 원인 | 조치 |
|---|---|---|
| 캐릭터가 팔 벌린 T 자세로 미끄러진다 | `Animation` 컴포넌트를 **모델 최상위**에 달았다. 킷 클립의 커브 경로는 **리그 루트(`Root`) 기준**이라 450개가 하나도 바인딩되지 않는다. **오류도 경고도 없다** | `go.transform.Find("Root")` 에 단다 |
| 클립을 붙였는데도 T 자세 | FBX 에 클립이 **둘 이상**이고 실제 동작 앞에 `Root\|0.Targeting Pose`(바인드 자세)가 있다. `Resources.Load` 는 앞의 것을 집는다 | `Resources.LoadAll` 로 **이름으로** 고른다 |
| 캐릭터가 100배로 부풀거나 옆으로 눕는다 | 애니메이션 클립이 루트의 **배율·회전까지** 애니메이션한다. 맞춰 둔 배율이 `Play` 한 줄에 지워진다 | 배율은 **클립이 못 건드리는 껍데기**에 걸고, 임포트 시 루트 커브(`path == ""`)를 걷어낸다 |
| 한 클립만 돌고 마지막 프레임에 굳는다 | `Animation.wrapMode` 는 **기본 클립에만** 먹는다 | `anim[clip].wrapMode` 로 **상태**에 건다 |
| 개체가 통째로 안 보인다 (위치·크기·머티리얼 전부 정상) | 스킨드 메시 컬링 바운드를 눈대중으로 박았다. 바인드 포즈 바운드는 **원점 근처에 뭉쳐 있어**(실측 0.04 유닛) 부풀려도 몸을 못 감싼다 | 주역은 `updateWhenOffscreen = true`. 무리는 **생성 시 실제 자세를 한 번 재서** 로컬 공간으로 되돌려 넣는다 |
| 화면이 마젠타 | `Shader.Find` 대상은 아무도 참조하지 않아 **스트리핑된다** | 셰이더를 `Assets/Resources/` 에 둔다 |
| `CapsuleCollider` 같은 클래스가 아예 없다 | 엔진 코드 스트리핑이 Physics 모듈을 뺐다 | 유니티 물리를 쓰지 않는다 — 원 충돌 + 균일 격자를 직접 짠다 |
| 한글이 전부 네모 | WebGL 에는 시스템 폰트가 없다 | 소스의 문자열 리터럴에서 charset 을 뽑아 **정적 SDF 아틀라스**를 굽는다 (`FontBake`) |
| 로딩이 0% 에서 멈춘다 | `.gz` 를 `Content-Encoding` 없이 내보냈다. nginx `location` 에 `types { }` 블록이 없으면 `default_type` 이 안 먹는다 | 산출물 4종에 명시 route |
| 세로에서 가상패드가 게임 화면을 덮는다 | `lib/touch.js` 는 캔버스 맞춤(fit)을 켠 게임에만 하단 띠를 만든다. 유니티는 캔버스를 스스로 관리해 `data-fit="0"` 이다 | 템플릿이 같은 규격(비율 0.28)으로 띠를 직접 계산한다 |
| **프로젝트가 통째로 사라진다** | 빌드 출력 폴더 안에 프로젝트를 뒀다. 유니티는 빌드 시 출력 폴더를 **비운다** | §4 배치. 임시 폴더에 굽고 산출물만 옮긴다 |
| 폰이 뜨겁다 | 픽셀 수(DPR) × 전체화면 포스트 패스 × MSAA 샘플이 **서로 곱해진다** | 전역 가드레일 G7. 기기로 갈라 폰만 깎는다 |

**공통 교훈**: 이 목록의 절반이 "오류 없이 조용히 안 된다" 다. 유니티는 바인딩 실패·스트리핑·
컬링을 예외로 알리지 않는다. **눈으로 보이는 것을 근거로 삼지 말고 값을 찍어서 확인한다** —
파일럿에서 캐릭터가 안 보이는 원인을 세 번 추측으로 고쳤고 세 번 다 틀렸다. 브라우저 콘솔에
실제 수치(바운드·배율·클립 이름)를 찍고 나서야 원인이 나왔다.

---

## 관련

- `docs/standards/game-cleanroom-pipeline.md` — 캔버스 라인의 단일 원본. 기술 도입 게이트 §8 이 이 문서의 진입점
- `docs/conventions/game-input-standard.md` — 가상패드 배치 규격 (유니티도 같은 규격을 쓴다)
- `game/CLAUDE.md` — 카탈로그 등록·`supports_mobile`·`orientation` 시드
- `k8s/CLAUDE.md` — CI 테스트 게이트가 왜 유니티 빌드를 거기 넣으면 안 되는지
- `scripts/lint-game-mobile.py` — 엔진과 무관하게 통과해야 하는 정적 검사

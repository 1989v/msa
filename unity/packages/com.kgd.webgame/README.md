# com.kgd.webgame

1989v 게임 플랫폼용 공용 유니티 계층. 게임 코드는 이 패키지의 공개 API 만 부른다.

게임 프로젝트에서 `Packages/manifest.json` 에 로컬 경로로 건다:

```json
"com.kgd.webgame": "file:../../../../../../unity/packages/com.kgd.webgame"
```

## Runtime

| 타입 | 하는 일 |
|---|---|
| `Kgd.KgdPlatform` | 랭킹 제출 · 세이브 · 플랫폼 신호 |
| `Kgd.KgdInput` | 가상패드 입력 |
| `Kgd.KgdDevice` | 기기 판정(터치 여부, 셸 예약 띠 치수) |
| `Kgd.KgdSave` | 서버 세이브 읽기/쓰기 |
| `Kgd.Play.KgdTraverse` | **젤다라이크의 뼈대** — 걷기·달리기·점프·등반·활공·구르기가 스태미나 하나로 |
| `Kgd.Play.KgdChase` | 쫓아와서 때리는 것 — 인지 → 추격 → **예고** → 타격 → 후딜 |
| `Kgd.Play.KgdOrbitCam` | 3인칭 궤도 카메라 — 지형을 두 번 피한다(바닥·벽) |
| `Kgd.Play.KgdWeapon` | 손에 든 것의 **규칙** — 사거리·범위·속도·동작이 한 벌 |
| `Kgd.Play.KgdScatter` | 지형 위에 흩기 · 둘러싸기 · 고도를 난이도로 |
| `Kgd.Play.KgdStamina` | 행동 자원 하나. 바닥나도 멈추지 않고 느려진다 |
| `Kgd.Art.KgdMesh` · `KgdMat` · `KgdKit` | 절차 메시 · 공용 머티리얼 · Kenney 로더 |
| `Kgd.Motion.IKgdWall` | 붙어서 오를 벽이 앞에 있나 (게임이 구현) |
| `Kgd.Motion.IKgdGround` | 게임이 구현 — 「이 자리 바닥이 얼마나 높은가」 하나만 답한다 |
| `Kgd.Motion.KgdLook` | **화면을 끌어 시점을 돌린다** — 가상패드를 잡은 손가락을 피한다 |
| `Kgd.Motion.KgdBody` | **걸어 다니는 몸의 판정** — 들어갈 수 있나 · 미끄러지기 · 박힘 풀기 · 착지 |
| `Kgd.Motion.KgdObstacles` | 장애물 기둥 격자 — 막기·올라서기·붙어 오르기가 같은 규칙에서 나온다 |
| `Kgd.Content.KgdChapters` | 챕터 아트 번들을 받아 이름으로 찾는다 (ADR-0085) |
| `Kgd.Sound.KgdTone` | 효과음을 **파형으로 만든다** — 오디오 파일을 넣지 않는다 |
| `Kgd.Terrain.KgdPlateau` | **고지대** — 램프 하나로만 오르는 팔각 절벽의 모양·높이 |
| `Kgd.Terrain.KgdPlateauBuilder` | 그 고지대를 그리고 막는다 |
| `Kgd.Terrain.IKgdTerrainSink` | 게임이 구현하는 출력구 — 사각(`Quad`)·자유 사각면(`Face`)·막는 원판·바닥색 |

## 새 게임을 시작할 때

```
Unity -batchmode -quit -executeMethod Kgd.Editor.Scaffold.CreateStarter
Unity -batchmode -quit -executeMethod Kgd.Editor.Scaffold.CreateMainScene
```

`StarterEntry.cs` 가 나온다 — **평지 하나 · 기둥 여덟 · 쫓아오는 것 하나**로 걷기·달리기·
점프·기어오르기·활공·구르기·시점이 처음부터 돈다. 거기서 규칙만 바꾸면 새 게임이 된다.

씬 골격만 만들어 두면 다음 사람이 「무엇부터 붙이나」에서 막힌다. 그리고 이 생성기가
**패키지의 두 번째 사용자**다 — 하나만 쓰는 동안은 「쓸 수 있다」가 주장이지만,
여기서 컴파일되면 그건 확인이다.


```csharp
sealed class MyWorld : IKgdGround, IKgdWall { … }          // 지형은 게임이 만든다

var move = new KgdTraverse(KgdTraverse.Tuning.Default, staminaCap: 100f);
var cam  = new KgdOrbitCam(camera, world, move.Pos);
var foe  = new KgdChase(KgdChase.Tuning.Default, at);

// 매 프레임
move.Tick(dt, wish, world, world);
cam.Tick(dt, move.Pos, eyeHeight: 1.35f, close: move.Now == KgdTraverse.State.Climb);
foe.Tick(dt, move.Pos, world, move.Body);
```

이동·충돌·시점·적 행동·타격감·챕터·소리·플랫폼이 여기서 나온다.
**게임이 새로 만드는 것은 규칙·레벨 배치·UI 배치·아트**다.

## 이동·충돌 (Kgd.Motion)

**유니티 물리를 쓰지 않는다.** 엔진 코드 스트리핑이 Physics 모듈을 빼서 WebGL 빌드에는
`CapsuleCollider` 조차 없을 수 있다. 대신 규칙 하나로 전부 낸다 —
**바닥이 발보다 `StepUp` 넘게 솟아 있으면 못 들어간다.**

```csharp
sealed class MyWorld : IKgdGround
{
    readonly KgdObstacles _things = new(cell: 8f);
    public float HeightAt(Vector3 p) => Mathf.Max(TerrainAt(p), _things.TopAt(p));
}

static readonly KgdBody Body = new(radius: 0.42f, stepUp: 1.1f, stepDown: 1.2f);

// 매 프레임
Pos = Body.Resolve(world, Pos, Pos + vel * dt);   // 벽에 막히고 미끄러진다
Pos = Body.Unstick(world, Pos);                   // 박혔으면 밀어낸다
Pos.y = Body.Settle(Pos.y, world.HeightAt(Pos), onGround, out bool landed);
```

지켜야 할 것 — **넷 다 실기에서 터진 것이다** (아홉 종, 2026-09-01):

| 값 | 안 지키면 |
|---|---|
| `Radius` 로 **테두리도** 본다 | 가운데 한 점만 보면 모델 절반이 절벽에 박힌 채 걷는다 |
| 시점은 `KgdLook` 으로 받는다 | `Input.GetTouch(0)` 은 **스틱을 잡은 손가락**이다. 그대로 쓰면 걸을 때마다 화면이 같이 돈다 |
| `StepDown` 을 둔다 | 내리막에서 매 프레임 공중 상태가 되어 **달리기 애니메이션이 끊긴다** |
| `Unstick` 은 **중심이 벽 안일 때만** 민다 | 벽 **옆에** 서 있기만 해도 밀려나 달리다 멈추다를 되풀이한다 |
| 장애물은 **기둥**으로 넣는다 | 막기만 하면 뛰어넘는 순간 발밑이 없어 그대로 관통한다 |

`StepUp` 과 점프 높이(`v²/2g`)의 관계가 **무엇을 오를 수 있나**를 정한다.
계단 한 단이 점프 정점보다 높으면 걸어서도 뛰어서도 못 오르고, 등반이 유일한 길이 된다.

## 고지대 (Kgd.Terrain)

스타크래프트식 고지대다. **원이 아니라 팔각형**이고, 램프는 **대각선 한 면**에만 난다.
둥근 언덕은 아무리 높여도 그 느낌이 나지 않는다 — 모서리가 없으면 「여기가 절벽 끝」이라는
선이 안 생기고, 램프가 「면 하나를 잘라낸 자국」으로 읽히지 않는다. 원작의 입구가
「대각선 왼쪽 아래 / 오른쪽 아래」 둘뿐인 것도 같은 이유다(위로 난 역입구는 타일 조각을
손으로 이어 붙여야 나온다).

```csharp
var hill = new KgdPlateau {
    Center = at, Radius = 12.5f, Height = 5f,
    RampYaw = KgdPlateau.SnapRampYaw(towardBase),   // 반드시 대각선에 붙인다
};
KgdPlateauBuilder.Build(hill, mySink, KgdPlateauPalette.Default);

float groundY = hill.HeightAt(actorPos);   // 비탈 위에서는 경사로 이어진다
```

### 입구는 여덟 방향 전부 된다

팔각형이라 면이 여덟이고, 램프는 그중 한 면을 자른다. `SnapRampYaw` 가 45° 눈금에 붙인다.

```
        0(N)
   315 ┌──┐  45
       │  │
 270 ──┤  ├── 90
       │  │
   225 └──┘ 135
       180(S)
```

- **축 넷(0·90·180·270)** 과 **대각선 넷(45·135·225·315)** 이 모두 같은 품질로 나온다.
  둘 다 실제로 구워 화면으로 확인했다(궁수 키우기, 2026-08-30).
- 눈금을 벗어난 각도는 **보기만 어색한 게 아니라 걷는 면이 그려진 면과 어긋난다** —
  최대 0.8 유닛 뜨고, 비탈 아래 모서리 일부는 반대로 바닥으로 꺼진다. 그래서
  `RampYaw` 는 필드가 아니라 넣는 즉시 스냅하는 프로퍼티다.
- **면 길이가 방향마다 다르다.** `t = Radius·Chamfer·√2 − Radius` 라 할 때
  축 면은 `2t`, 대각선 면은 `√2(Radius − t)` 다. 반경 10·Chamfer 1.16 이면 12.8 대 5.1 —
  **대각선이 훨씬 짧다.** `RampTopWidth` 를 짧은 쪽보다 넓게 잡으면 입구가 이웃 벽에 걸린다.

### 입구가 **위쪽**으로 날 때 (역입구)

브루드워 지형 편집기에는 아래로 난 입구밖에 없다. 위로 난 입구(**역입구**)는 절벽·입구·
다리 타일을 손으로 이어 붙여 만들었고, 만들 때 따지는 것이 **자연스러움 · 시야차폐 ·
입구 너비** 셋이었다(강낭땅콩 「스타 맵 만들기 강의 중급8」). 손이 많이 가서 대개
남이 만들어 둔 맵에서 복사해 썼다.

왜 그 각도만 어려웠는가 — **언덕 몸통이 입구를 가리기 때문**이다. 카메라가 위에서
비스듬히 내려다보면, 반대편으로 난 비탈은 고원 뒤로 숨는다.

우리 지형은 3D 라 그 경우도 그냥 나온다(궁수 키우기에서 `RampYaw = 0`, 즉 카메라
반대쪽으로 난 입구를 실제로 구워 확인했다 — 2026-08-30). 다만 **읽히는 단서가 하나로
줄어든다**: 정면 입구는 비탈면이 통째로 보이지만, 위쪽 입구는 **테두리가 끊긴 자국**이
거의 전부다. 그래서

- **테두리를 램프 면에서 반드시 끊는다.** 이어 놓으면 위쪽 입구는 아예 안 보인다.
  (실제로 그렇게 만들었다가 「입구 식별이 어렵다」는 신고를 받았다.)
- **볼 벽(cheek)** 을 남긴다 — 끊긴 자리의 양옆이 서 있어야 「구멍」이 아니라 「길」로 읽힌다.
- 위쪽 입구를 쓸 거면 `RampTopWidth` 를 너무 좁히지 않는다. 끊긴 폭이 곧 단서다.

조절하는 값:

| 값 | 뜻 |
|---|---|
| `Radius` | 축 방향 반폭. 팔각형이라 최대 반경은 이보다 조금 크다 (`Reach` 참조) |
| `Chamfer` | 모서리를 얼마나 깎나. 1.414 사각형 · 1.16 팔각 · 1.0 마름모 |
| `ToLight`(팔레트) | 빛이 오는 방향. **게임의 실제 태양과 맞춘다** — 안 맞추면 절벽이 그림자와 반대로 밝아진다 |
| `RampLength` | 비탈 길이. **높이 대비 짧으면 걸어 오르는 게 아니라 벽을 타는 느낌**이 된다 |
| `RampTopWidth` / `RampBottomWidth` | 위가 좁고 아래가 넓어야 입구가 초크로 읽힌다 |
| `Tag` | 게임이 붙이는 꼬리표. 패키지는 읽지 않는다 |

지켜야 할 것:

- **램프 각도는 넣는 즉시 대각선(또는 축)으로 스냅된다.** 어중간한 각도를 쓰면 보기에만
  어색한 게 아니라 **걷는 면이 그려진 면과 어긋난다** — 마루 위를 공중에서 걷거나 비탈
  아래 모서리에서 꺼진다. 그래서 `RampYaw` 는 필드가 아니라 스냅하는 프로퍼티다.
- **`HeightAt` 을 개체마다 매 프레임 부를 거면 `Reach` 로 먼저 거른다.** 고지대가 수십 개면
  그 전부에 삼각함수를 태울 이유가 없다.
- **비탈 옆벽의 원판을 빼지 않는다.** 그림만 있으면 옆으로 뚫고 올라온다 — 궁수 키우기에서
  실제로 그랬다.
- 성능: `Build` 는 청크가 뜰 때 한 번 부른다. 매 프레임 부르는 API 가 아니다.
- **`TopCell` 을 반경에 맞춰 키운다.** 윗면 격자는 면적으로 들어가서, 기본값(2.2)을
  반경 190 에 쓰면 계단 한 장이 56,020 삼각형이 된다. 기본값은 반경 10~15 짜리 언덕 기준이다.
- **램프가 난 면도 양옆은 벽이 선다.** 램프 폭이 면 길이를 못 채우는 크기에서 면을 통째로
  비우면 그 차이가 절벽의 구멍이 된다 (반경 190 에서 107 유닛이 뚫려 안쪽이 다 보였다).
  램프가 면을 거의 덮는 크기에서는 남는 조각이 짧아 그려지지 않으므로 예전 모양 그대로다.

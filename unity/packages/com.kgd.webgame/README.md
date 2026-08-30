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
| `Kgd.Terrain.KgdPlateau` | **고지대** — 램프 하나로만 오르는 팔각 절벽의 모양·높이 |
| `Kgd.Terrain.KgdPlateauBuilder` | 그 고지대를 그리고 막는다 |
| `Kgd.Terrain.IKgdTerrainSink` | 게임이 구현하는 출력구 — 사각(`Quad`)·자유 사각면(`Face`)·막는 원판·바닥색 |

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

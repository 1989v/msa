# 게임 아트 마지노선

> **2026-08-14 기준 상향**: 신규 게임의 마지노선은 **`abyssal-crown`(심연의 왕관)** 수준이다 —
> 고해상(1440p급) 자체 아트 파이프라인(절차 생성/리그 베이크), 자체 신스 사운드+BGM,
> 빌드 시스템 20종+ 급 콘텐츠 깊이, 콘솔 에러 0, 비주얼 자체 개선 반복 2회 이상.
> 제작은 **클린룸 서브세션**(기존 게임·lib 열람 금지)에 위임하고, 메인 세션은 플랫폼
> 통합(시드·세이브·랭킹·썸네일)을 맡는다 — 클린룸 실험 2회에서 기존 맥락이 품질 앵커로
> 작용함이 실측 확인됐다 (`abyssal-crown/DESIGN.md`, `raging-fist-saga/DESIGN.md`).
>
> 아래 내용은 **기존 16px 타일셋 게임(레거시 트랙)의 최저선**으로 유지된다.

캔버스 게임의 **개체 렌더링 최저선**. 기준작은 `depth-delver` 이고, 도구는 `portal-fe/public/games/lib/spr.js` 다.

## 왜 이 기준인가

36종을 계측해 보니 품질 차이는 **효과의 양이 아니라 개체를 무엇으로 그리는가**에서 갈렸다.
효과 출현 횟수는 `dawn-ward` 80 · `midnight-tide` 76 으로 `depth-delver` 38 보다 높은데도
체감 품질은 반대였다. 실제 차이는 이것뿐이었다.

| | depth-delver | 나머지 |
|---|---|---|
| 스프라이트를 구워 캐시 | O | 36종 중 5종 |
| 개체 그리기 | 도트를 `drawImage` | **31종이 매 프레임 `fillRect`/`arc`** |
| 접지 그림자 | 11곳 | 대부분 0~2곳 |

원이 적이고 사각형이 블록이면 어떤 후처리를 얹어도 격이 올라가지 않는다.

## 필수 (미달이면 머지하지 않는다)

1. **개체는 구워서 캐시한다** — `Spr.make(key, w, h, paint)`. 매 프레임 도형을 쌓지 않는다.
   방향·프레임·상태 변형은 key 에 녹인다(`'foe' + kind + dir`).
2. **명암 3단** — `Spr.pal(base)` 의 `hi/mid/lo`. 단색 덩어리 금지.
3. **접지 그림자** — `Spr.ground()`. 개체가 바닥에 붙어 보이게 하는 가장 큰 단서다.
4. **어두운 외곽선** — `Spr.outline()`. 배경이 복잡해도 실루엣이 살아야 한다.
5. **개체에 이모지를 쓰지 않는다** — 플랫폼마다 모양이 다르고 도트와 섞이면 이질적이다.
   HUD·버튼·결과 문구에는 써도 된다.
6. **적은 종류마다 실루엣이 달라야 한다** — 색만 바꾼 같은 형태는 같은 적으로 읽힌다.

## 권장

- 이동체는 최소 2프레임(정지/보행). 상하 1px 바브만으로도 살아난다.
- 광원이 있으면 `hi` 를 광원 쪽에, `lo` 를 반대쪽에 일관되게 둔다.
- 팔레트는 게임당 6~10색으로 묶는다. 색이 많아질수록 도트가 지저분해진다.
- 스프라이트는 32×32 기준. 보스·구조물은 배수로 키운다.

## 쓰는 법

```html
<script src="../lib/spr.js"></script>
```

```js
function foeSprite(kind) {
  return Spr.make('foe' + kind, 32, 32, function (g) {
    var p = Spr.pal('#4fd18b');
    Spr.px(g, 7, 14, 18, 13, p.mid);
    Spr.px(g, 9, 11, 14, 5,  p.hi);
    Spr.px(g, 5, 20, 22, 7,  p.lo);
    Spr.px(g, 11, 17, 3, 4, '#0b2a1c');    // 눈 — 실루엣을 읽히게 하는 포인트
    Spr.outline(g, 32, 32);                // 몸통을 다 그린 뒤
    Spr.ground(g, 32, 32);                 // 마지막 — 알아서 밑으로 깔린다
  });
}
Spr.draw(cx, foeSprite(f.kind), f.x - cam.x, f.y - cam.y, { flip: f.vx < 0 });
```

`Spr.draw` 는 **중심 기준**이다. 발밑 기준으로 놓으려면 `{ anchorY: 1 }`.

## 적용 현황

기준 충족: `depth-delver`(기준작) · `drift-continent` · `iron-vanguard` · `cave-glide`

기준에 가까움(외곽선·명암은 있고 접지 또는 굽기가 빠짐): `crimson-ravine` · `rift-front` ·
`gate-holdout` · `outlaw-frontier` · `storm-corridor` · `spud-arena`

나머지는 노출 순으로 순차 전환한다. 비주류 게임은 전환 대신 정리 대상이므로 목록에 넣지 않는다.

> 계측할 때 **헬퍼 이름으로 세지 말 것**. 처음에 `spriteCache` 같은 식별자를 grep 해서
> "5종만 굽는다"고 셌는데, 실제로는 게임마다 헬퍼 이름이 달라 절반을 놓쳤다.
> `createElement('canvas')` + `drawImage` 로 세는 게 맞고, 그 기준으로는 17종이 아무것도 굽지 않는다.

## 관련

- 도구: `portal-fe/public/games/lib/spr.js`
- 모바일 셸·조작: `portal-fe/public/games/lib/touch.js`
- FE 디자인 가드레일: `docs/conventions/frontend-design.md`

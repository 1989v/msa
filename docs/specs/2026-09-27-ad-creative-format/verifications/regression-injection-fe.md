# 회귀 주입 — FE (portal-fe)

2026-09-27. `planning/test-quality.md` 회귀 주입 표의 FE 세 줄. 주입은 원본을 스크래치패드에 복사해 두고 한 곳만 바꾼 뒤 테스트를 돌리고, 원본으로 되돌려 `cmp` 로 같음을 확인했다.

| 대상 | 주입 | 무는 테스트 | 결과 |
|---|---|---|---|
| parseAd | `format` 이 없으면 `null`(광고를 버림) — `adsApi.ts` `parseFormat` | C1 `adsApi.test.ts`, C2 `BannerAd.test.tsx`, 기존 `AdSlot.test.tsx` | 빨간불 3 |
| 업로드 | 검사 실패에도 전송 — `CreativesPanel.tsx` 의 `if (!inspection.ok)` 블록 삭제 | C5 `CreativeUpload.test.tsx` | 빨간불 2 |
| 업로드 | 헤더 대신 디코딩으로 크기 판정 — `imageHeader.ts` `inspectUpload` 가 `createImageBitmap(file)` 을 부름 | C5 헤더 폭탄 | 빨간불 1(아래 변형) |

## 1. parseAd — format 없음을 버림

```
$ npx vitest run src/components/ads src/pages/games
   × parseAd — 광고 형태 > 형태가 없으면 카드로 받는다
   × AdSlot — 형태 분기 > 카드 우승자(형태 없음 포함)는 카드로 그린다
   × AdSlot — 채움 순서 > 유료 광고가 있으면 카드를 그리고 AdSense 는 채우지 않는다
      Tests  3 failed | 105 passed (108)
```

## 2. 검사 실패에도 전송

```
$ npx vitest run src/pages/ads
   × 소재 업로드 — 보내기 전 검사 > 비율이 형태 규격과 다르면 실제 값·허용 값·권장 크기를 보이고 보내지 않는다
   × 소재 업로드 — 보내기 전 검사 > 헤더 폭탄(20000×3125)은 풀지 않고 헤더 값으로 거절한다
      Tests  2 failed | 34 passed (36)
```

판정 근거는 대상의 산출물이다 — 전송 함수(`submitCreative`) 호출 여부와 화면이 그린 거절 문구.

## 3. 헤더 대신 디코딩

처음 주입(디코딩한 비트맵의 크기를 판정에 씀)은 7건이 빨갛게 됐지만, 대부분은 테스트의 `createImageBitmap` 대역이 값을 돌려주지 않아 생긴 오류다. 그래서 **디코딩은 하되 크기는 헤더와 같다고 치는** 변형으로 다시 주입했다 — 판정 결과가 같아도 디코딩 자체를 잡는지 본다.

```
$ npx vitest run src/pages/ads/__tests__/CreativeUpload.test.tsx -t '헤더 폭탄'
   × 소재 업로드 — 보내기 전 검사 > 헤더 폭탄(20000×3125)은 풀지 않고 헤더 값으로 거절한다
     → expected "spy" to not be called at all, but actually been called 1 times
      Tests  1 failed | 9 skipped (10)
```

무는 단언은 `createImageBitmap`·`URL.createObjectURL` 이 불리지 않았다는 것이다 — 폭탄 픽스처는 서명·IHDR 만 있는 수십 바이트라 풀 수 있는 이미지가 아니고, 판정이 헤더에서 나왔다는 것만 남는다.

## 되돌린 뒤

```
$ npx vitest run src/components/ads src/pages/ads src/pages/games
 Test Files  17 passed (17)
      Tests  144 passed (144)
```

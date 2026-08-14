# CREDITS — 심연의 왕관 (Abyssal Crown)

이 게임은 **런타임 외부 의존성이 0** 입니다. 모든 리소스는 이 폴더 안에 포함되어 있고,
빌드 스텝·CDN·네트워크 요청 없이 정적 파일만으로 동작합니다.

---

## 1. 폰트 (외부 에셋 — 다운로드하여 포함)

### Galmuri — by quiple (Sangwoo Kim)

| 항목 | 내용 |
|---|---|
| 파일 | `assets/fonts/Galmuri11.woff2`, `Galmuri11-Bold.woff2`, `Galmuri14.woff2`, `Galmuri9.woff2` |
| 출처 | https://github.com/quiple/galmuri (`dist/` 디렉터리) |
| 라이선스 | **SIL Open Font License 1.1 (OFL-1.1)** |
| 라이선스 전문 | `assets/fonts/LICENSE.txt` (원본 저장소의 `dist/LICENSE.txt` 그대로 포함) |
| 취득일 | 2026-08-14 |

**라이선스 검증**: GitHub API (`GET /repos/quiple/galmuri`) 응답의 `license.spdx_id` 가
`OFL-1.1` 임을 확인했고, 저장소의 `dist/LICENSE.txt` 를 그대로 동봉했습니다.

OFL-1.1 은 **웹폰트 임베딩·재배포·상업적 사용을 허용**합니다. 준수 사항:

- 저작권 표시와 라이선스 전문을 함께 배포 — `assets/fonts/LICENSE.txt` 로 충족
- 폰트 파일 자체를 판매하지 않음 — 게임에 임베딩만 함
- 예약 서체명(Reserved Font Name)을 변경하지 않음 — 원본 파일 그대로 사용, 개변 없음

Galmuri 는 닌텐도 DS 계열의 한글 비트맵 서체 디자인에서 영감을 받은 픽셀 서체로,
한글 글리프가 완비되어 있어 이 게임의 **전면 한국어 UI** 에 그대로 쓸 수 있었습니다.
`Galmuri11` 을 본문(11의 정수배: 22px), `Galmuri11-Bold` 를 강조,
`Galmuri14` 를 대형 타이틀에, `Galmuri9` 를 작은 라벨에 사용합니다.

---

## 2. 그래픽 — 100% 절차 생성 (외부 에셋 없음)

이미지 파일은 **한 장도 사용하지 않았습니다.** 스프라이트시트, PNG, SVG 파일이 없습니다.

### 왜 CC0 스프라이트를 쓰지 않았는가 (의사결정 기록)

CC0 에셋 소스(Kenney.nl, OpenGameArt 등)를 조사했고 접근 가능함을 확인했습니다.
그럼에도 캐릭터·환경 아트는 절차 생성으로 결정했습니다. 근거:

1. **아트 디렉션 일관성** — 심해 3개 지역이 하나의 팔레트 체계(`js/art.js` 의 `BIOME_THEME`)
   아래 묶여야 합니다. 서로 다른 작가의 CC0 팩을 섞으면 라인 웨이트·채도·원근이 어긋나
   "AI 콜라주" 처럼 보입니다.
2. **애니메이션 자유도** — 스쿼시/스트레치, 대시 잔상, 집게 벌어짐, 촉수 솟아오름,
   페이즈 전환 시 껍질 균열 발광 등은 프레임 기반 스프라이트로는 전부 별도 시트가 필요합니다.
   벡터 파라미터로 그리면 상태 변수 하나로 표현됩니다.
3. **가독성 우선** — 로그라이크 액션에서 가장 중요한 건 "예고 도형과 캐릭터 실루엣의 분리"
   입니다. 지형 텍스처의 대비·알파를 예고 색상 기준으로 직접 튜닝할 수 있어야 했습니다
   (실제로 검증 중 바닥 무늬가 예고와 경합해 2회 수정했습니다).
4. **용량** — 전체 그래픽 코드가 폰트 1개보다 작습니다.

### 절차 생성 방식

| 대상 | 기법 | 위치 |
|---|---|---|
| 바닥 타일 | 지역별 256×256 타일을 부팅 시 1회 베이크 (슬랩 그리드 + 베벨 + 지역별 디테일 + 픽셀 그레인) | `art.js: floorTile()` |
| 코스틱(수중 광선) | 4개 정현파 간섭 패턴을 256×144 × 12프레임으로 프리렌더 후 순환 | `art.js: causticFrame()` |
| 비네트 / 필름 그레인 | 방사 그라디언트 · 랜덤 노이즈 캔버스 | `art.js: vignette(), grainTexture()` |
| 캐릭터 / 적 / 보스 | 매 프레임 벡터 드로잉 (림라이트 그라디언트 + 다크 아웃라인 규약) | `art.js: shapeStyle(), organicBlob(), limb()` |
| 신 문장(sigil) | 코드로 그린 스트로크 패스 8종 | `art.js: drawGlyph()` |
| 아레나 장식 | 시드 RNG 기반 산호/뼈/기둥/첨탑 실루엣 배치 | `rooms.js: generateDecor()` |

시드 RNG(`core.js: Rng`, mulberry32)를 써서 같은 방은 항상 같은 모습으로 생성됩니다.

---

## 3. 사운드 — 100% WebAudio 런타임 합성 (외부 에셋 없음)

오디오 파일도 **한 개도 없습니다.** `js/audio.js` 가 모든 소리를 실시간 합성합니다.

| 대상 | 기법 |
|---|---|
| 효과음 30종 | 오실레이터(sine/square/saw/triangle) + 공유 노이즈 버퍼 + 바이쿼드 필터 + ADSR 엔벨로프 |
| 타격감 | 노이즈 로우패스 스윕 + 저역 사인 드롭 + 고역 클릭의 3층 구성 |
| 공간감 | `StereoPannerNode` 로 카메라 기준 좌우 배치 |
| BGM | 25ms lookahead 스케줄러 기반 생성 음악. 지역별 스케일(에올리안/프리지안/로크리안)·BPM·레이어(베이스/패드/아르페지오/리드/드럼) |
| 공간 리버브 | 지수 감쇠 노이즈로 만든 임펄스 응답 + `ConvolverNode`, 그리고 피드백 딜레이 |
| 마스터링 | `DynamicsCompressorNode` 로 다중 타격 시 클리핑 방지 |

---

## 4. 코드

전부 이 과제를 위해 새로 작성했습니다. 외부 게임 엔진·라이브러리·프레임워크를
사용하지 않았습니다 (순수 ES Modules + Canvas 2D).

---

## 5. 폰트 라이선스 고지 (배포 시 필수 표기)

```
Galmuri
Copyright (c) 2020, Sangwoo Kim (https://quiple.dev)
Licensed under the SIL Open Font License, Version 1.1.
Full license text: assets/fonts/LICENSE.txt
```

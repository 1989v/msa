# CREDITS — 레이징 피스트 사가 (Raging Fist Saga)

이 게임은 런타임에 외부 CDN·외부 호스트를 전혀 사용하지 않는다.
모든 리소스는 이 폴더 안에 포함되어 있다.

---

## 번들된 서드파티 에셋

### Galmuri (갈무리) — 비트맵 한글 폰트

| 항목 | 내용 |
|---|---|
| 파일 | `assets/fonts/Galmuri11.woff2` (본문·HUD), `assets/fonts/Galmuri14.woff2` (제목) |
| 저작자 | Lee Minseo (quiple) — <quiple@quiple.dev> |
| 출처 | https://github.com/quiple/galmuri · https://galmuri.quiple.dev |
| 배포 경로 | npm 패키지 `galmuri@2.40.3` 의 `dist/` (빌드 시점에 1회 내려받아 폴더에 포함) |
| 라이선스 | SIL Open Font License 1.1 |
| 라이선스 원문 | `assets/fonts/LICENSE-Galmuri-OFL-1.1.md` (배포처 원문 그대로 보관) |

**라이선스 검증 내용** — OFL 1.1 원문(위 파일) 확인 결과:

- 폰트를 자유롭게 사용·연구·수정·재배포할 수 있다.
- 폰트 자체를 단독 판매하는 것만 금지된다. 소프트웨어에 **번들·임베드·재배포하는 것은 명시적으로 허용**된다
  ("The fonts... can be bundled, embedded, redistributed and/or sold with any software").
- 재배포 시 저작권 고지와 라이선스 원문을 함께 포함해야 한다 → 본 파일과
  `assets/fonts/LICENSE-Galmuri-OFL-1.1.md` 로 충족.
- Reserved Font Name 이 지정되어 있지 않고, 폰트 파일을 개변하지 않았으므로 개명 의무는 발생하지 않는다.

npm 패키지 메타데이터의 `license` 필드도 `OFL-1.1` 로 확인했다.

---

## 직접 만든 것 (제3자 에셋 아님)

아래는 전부 이 저장소의 코드가 런타임/로딩 시점에 **절차적으로 생성**한다.
외부에서 가져온 스프라이트·타일셋·오디오 파일은 하나도 없다.

| 영역 | 방식 | 코드 |
|---|---|---|
| 캐릭터 스프라이트 11종 | 스켈레톤 리그 → 볼륨 렌더 → 1px 외곽선 → 15비트 색 양자화 → 크롭 베이크 | `js/rig.js`, `js/sprites.js`, `js/chars.js` |
| 애니메이션 34클립 | 순환 동작은 절차적, 타격 동작은 프레임 단위 수작업 포즈 | `js/anim.js` |
| 배경 4테마 × 5레이어 | 시드 RNG 기반 절차 드로잉 후 레이어 캔버스로 베이크 | `js/stages.js` |
| 오브젝트·아이템·무기 | 캔버스 도형 드로잉 | `js/entities.js` |
| 효과음 26종 | WebAudio 오실레이터 + 노이즈 버퍼 + 바이쿼드 필터 신스 | `js/audio.js` |
| BGM 7트랙 | WebAudio 스텝 시퀀서 (베이스/리드/드럼 패턴) | `js/audio.js` |
| 타격 연출 | 파티클·임팩트 스파크·링·데미지 팝업 | `js/fx.js` |

## 폰트 폴백

Galmuri 로드 실패 시 `system-ui, sans-serif` 로 폴백한다. 게임 로직은 폰트에 의존하지 않는다.

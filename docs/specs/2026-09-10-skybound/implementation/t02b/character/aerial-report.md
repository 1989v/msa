# T02B-4b-1 · 점프 / 낙하 / 착지 자세 클립

2026-09-11. 자체 제작 나루 리그의 독립 포즈 진단이다. 다른 게임이나
외부 모션 데이터는 사용하지 않았다. 모델·atlas·기존 walk/run은 수정하지 않았다.

| 클립 | 길이 | 재생 정책 | 자세 |
|---|---:|---|---|
| jump | 0.7초 | 한 번, 마지막 자세 유지 | 작은 준비 동작 후 무릎 회수 |
| fall | 1.2초 | 반복 | 굽힌 무릎과 균형을 잡는 팔 |
| land | 0.9초 | 한 번, 마지막 자세 유지 | 양발 접지, 골반·무릎 흡수, 원래 자세 복귀 |

`src/aerial.mjs`의 `createAerialClips(THREE)`가 표준 위치/quaternion 트랙을
만든다. `AERIAL_PLAYBACK`은 glTF 밖의 viewer 재생 정책이다. GLB는 클립을
담지만 LoopOnce/LoopRepeat 정책을 저장하지 않으므로 loader 뒤에서 적용한다.

뷰어 `#motion`에서 jump/fall/land를 선택할 수 있다. 선택 시 0초 정지 자세를
표시하며 재생 중 선택하면 새 클립이 시작된다. 점프·착지는 끝나면 정지하고
다시 재생할 수 있다. 정지·포즈 해제·LOD 변경은 bind 자세를 복구한다.
초기화는 기본 동작과 사선 시점도 복구한다. 표시되는 메시는 GLB 재로딩 결과다.

브라우저 검증은 `setMotion(name, { time, play })`와 `getMotionSnapshot()`을
사용한다. 일회성 클립의 `time >= duration`은 끝 자세로 clamp되며,
`motionTime`/`motionCompleted`와 snapshot의 `playback`/`completed`로 확인한다.

## 실행 근거

새 Node 검사 3개가 통과했다. 유한 값·정규화 quaternion·fall 주기 일치,
일회성 clamp, 점프 끝의 굽힘, 정지 복귀를 확인한다. 착지는 두 LOD의
97시점에서 실제 발바닥 최저점 Y가 −4mm 이상/15mm 미만인지 검사하고,
끝 시점의 모든 스킨 정점이 원래 위치로 돌아오는지 확인한다.
모델·보행·공중 자세 전체 검사 결과: **13 tests, 13 pass, 0 fail**.
빌드 출력: `Built character/viewer.bundle.js`.

## 이번 단위의 한계

- 이는 제자리 포즈다. 실제 상승·중력·낙하 높이·착지 판정은 T02A 측 이동
  로직의 책임이며 연결하지 않았다. 골반 Y 변형은 자세 변화이며 root 궤적이 아니다.
- 상태 전환·블렌딩·지형 적응·점프 타이밍 동기화는 다음 단위다.
- 기존 발목 중첩 회귀는 walk/run에서 유지한다. 공중 포즈 전체의 의상·가방
  관통과 발목 겹침은 추가 시각 검수가 필요하다.
- 브라우저 클립 보존·재생 정책·캡처는 root의 별도 aerial 검증 보고서에서 확인한다.
- 기술 검사 통과는 캐릭터 아트 PASS 판정이 아니다.

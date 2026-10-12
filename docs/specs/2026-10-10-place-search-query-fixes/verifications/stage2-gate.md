# 단계 2 — 어휘 근거 GATE 측정 (2026-10-12 22:16~22:21 KST)

**판정: 채택하지 않는다(SR-7.3 「언어별 C 하락 ≤ 0.01」 영문 위반). 운영은 OFF 로 되돌렸다. 단계 3(CONFINE)은 같은 근거 확인을 쓰므로 같은 이유로 재지 않는다.**

## 방법
- 잡음 하한: 무변경 정기 실행 두 번(10-11 첫 실행 · 10-12 07:30)의 차이 — ko 0.006 · en 0.0006. 문턱 0.01 보다 작다.
- 운영 env `SEARCH_ATTRACTION_ANSWER_EVIDENCE_MODE` 를 GATE 로 바꿔(`2f2d21122`) 새 파드가 뜬 뒤 판정 세트 v3(228 질의)의
  상위 20개·건수·0건 사유·응답 시간을 클러스터 안 주소(`search:8083`, 캐시 없음)로 두 바퀴 모으고, 바로 OFF 로 되돌렸다(다음 커밋).
  OFF 도 같은 수집기로 5분 앞서 모았다. 수집기 `stage2/collect.py`.
- C 는 수집한 2바퀴째 상위 10개로 정기 평가와 같은 nDCG@10(NO_ANSWER 제외) 을 계산했다. OFF 를 이 계산기로 내면 정기 평가 값
  0.7368 · 0.7222 와 소수 넷째 자리까지 같다 — 계산기 확인.
- 풀링(SR-6.3): GATE 는 결과를 지우기만 한다. 바뀐 질의 4개가 전부 0건이 된 것이고 새로 들어온 문서는 0 — 추가 채점 불필요.

## 결과
| 조건 | OFF | GATE | 판정 |
|---|---|---|---|
| C ko | 0.7368 | 0.7368 | 변화 없음 |
| C en | 0.7222 | **0.7103 (−0.0119)** | **위반** |
| 0.05 넘게 나빠진 질의 | — | en 1 (「botanical garedn」 TYPO) | 통과(≤3) |
| NO_ANSWER 0건 | ko 2/7(자모 2) · en 2/6 | ko 2/7 · en **5/6** (egypt museum·mexico beach·daejeon beach 새로 0) | 좋아짐 |
| p50 · p95 · p99 (2바퀴째, ms) | 43.0 · 69.5 · 79.1 | 49.1 · 77.2 · 87.2 | 통과 |

바뀐 질의 전부: `botanical garedn`(en, 50→0) · `egypt museum`(432→0) · `mexico beach`(266→0) · `daejeon beach`(442→0). 모두 `NO_EVIDENCE`.

## 원인 — 영문 오타는 교정되지 않은 채 근거를 확인한다
- 국문 오타(경복굼·불국싸·해수욕쟝)는 교정이 먼저 일어나 영향이 없다. 영문은 교정이 없어 `garedn` 이 그대로 근거 질의에 들어가고
  색인에 없으니 0건이 된다. OFF 에서는 벡터 레그가 식물원 50건을 찾아 주던 질의다.
- 근거 질의에 `fuzziness: AUTO` 를 넣으면(`stage2/fuzzy.py`, 운영 `_count`): botanical garedn 0→38 · gyeongbokgoong 0→36 으로 살지만
  mexico beach 0→82 · daejeon beach 0→17 · eiffel tower 0→13 도 다시 결과를 낸다. egypt museum·qwxzv·zkvqjx 는 0 유지.
- 「색인에 없는 단어에만 오타 허용」도 가르지 못한다(`stage2/token-df.py`): `garedn` 0 · `mexico` 0 · `eiffel` 0 — 오타와 국내에 없는
  고유명사가 같은 모양이다.

## 다음 선택지 (사용자 결정)
1. OFF 유지 — 지금 상태.
2. 영문 오타 교정(사전 기반 did-you-mean)을 먼저 넣고 GATE 를 다시 잰다. 교정이 `garedn→garden` 은 고치고 `mexico` 는 그대로 두면 조건을 맞출 수 있다.
3. 국문만 GATE — ko 는 C 변화가 없지만 ko NO_ANSWER 도 그대로라 얻는 것이 없다. 권하지 않는다.

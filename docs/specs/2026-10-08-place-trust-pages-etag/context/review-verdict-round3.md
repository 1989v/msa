# 3라운드 심판 결과: 신뢰 페이지 + 상세 SSR ETag 스펙

판정할 발견은 test-strategy 리뷰의 T3-1 하나이고, 근거를 직접 확인한 뒤 **REVISE 로 유지**했습니다. architecture 리뷰는 SHIP 이고 「새 발견 없음」(`engineer-review-architecture-round3.md:39`)이라 판정할 대상이 없습니다.

T3-1 은 구현 코드를 막는 결함은 아닙니다. 테스트 단언 세 개와 회귀 주입 두 줄을 바꾸면 닫힙니다. 다만 강등할 근거는 없었습니다(ⓐ 표준 명시 · ⓑ 레포 선례 · ⓒ 인용 반증 모두 없음). 스펙 문장을 지금 바꾸지 않으면 구현자는 스펙대로 「자기가 쓴 리터럴과 대장만 비교하는 검사」를 짜게 됩니다. 그래서 유지가 맞습니다. 아래 편집을 이번 라운드에 반영하면 사용자에게 올릴 BLOCK 은 없습니다.

## 묶음 표

| id | 출처 | 판정 | 등급 | 한 줄 사유 |
|---|---|---|---|---|
| T3-1 | test-strategy R3 | keep | REVISE | 스펙 :19 의 비고 단언이 상수 값을 보지 않아, 결정 ③ 「대장과 페이지가 어긋나면 테스트 실패」가 비고 열에서 증명되지 않음 |
| (architecture R3) | architecture R3 | 해당 없음 | — | SHIP, 발견 0건 |

## 발견별 JSON

```json
[
  { "id": "T3-1 비고 대조가 상수가 아니라 테스트 안의 리터럴과 대장을 비교",
    "verdict": "keep",
    "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 19, "quote": "`**` 를 지운 대장 전문에 대기 실시간 측정 비고 「실시간 측정값으로 확정 전 자료」가 부분 문자열로 있고, TourAPI 비고의 핵심어 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있다. 상수에서 비고가 빈 문자열이 아닌 행은 정확히 넷" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 17, "quote": "「행마다 공공누리 유형이 다름(표본 제3유형 = 출처표시·변경금지)」" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 4, "quote": "③ 대장과 페이지가 어긋나면 테스트가 실패한다" },
      { "file": "docs/architecture/data-sources.md", "line": 168, "quote": "공공누리 유형은 **행마다 다르다**(`cpyrhtDivCd`, 표본은 `Type3` = 출처표시·변경금지)." },
      { "file": "docs/architecture/data-sources.md", "line": 261, "quote": "화면은 「출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료」와 측정소 이름 · 측정 시각을 단다." },
      { "file": "docs/architecture/data-sources.md", "line": 75, "quote": "| 축제·공연·행사 | TourAPI `searchFestival2` (국·영) | 필요 | 〃 (행마다 `cpyrhtDivCd`) |" },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/spec.md", "line": 43, "quote": "원천·라이선스 열 대조는 SR-1.4 상설 부정 테스트 ②③ 이 맡으므로 따로 주입하지 않는다." },
      { "file": "docs/specs/2026-10-08-place-trust-pages-etag/context/review-verdict-round2.md", "line": 207, "quote": "TourAPI 비고의 핵심어 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있다. 상수에서 비고가 빈 문자열이 아닌 행은 정확히 넷(SR-1.2)이다." }
    ],
    "reason": "인용이 원문과 일치한다(공개 문구 :17 에 「행마다 다르다」가 없어 핵심어 검사는 대장만 보고, 「정확히 넷」은 행 위치를 안 보고, :43 에 비고 축 주입이 없다). 수용 패턴이라는 표준이나 레포 선례도 없어 ⓐⓑⓒ 반증이 없으므로 유지한다. 결정 ③(:4)과 스펙 문장(:19)의 어긋남이지만 코드 위반 인용이 아직 없어 BLOCK 이 아니라 REVISE 다." }
]
```

**인용을 원문과 대조한 결과**
- `data-sources.md` §1 에서 라이선스 칸에 「(행마다」가 있는 행은 `:75-77` 세 행뿐입니다. 그래서 수정안의 「기대 집합을 대장에서 꺼낸다」는 지금 대장으로 정확히 세 행을 냅니다.
- `**` 를 지우면 `:168` 에 「행마다 다르다」와 「출처표시·변경금지」가 둘 다 들어 있습니다. `:261` 에는 「실시간 측정값으로 확정 전 자료」가 있습니다.
- 상수 공개 문구(`:17`)에는 「행마다」와 「출처표시·변경금지」가 둘 다 있으므로, 수정안의 상수 쪽 단언도 성립합니다.

**결함이 들어온 경로:** 이 문장은 2라운드 심판 편집 E2(b)(`review-verdict-round2.md:207`)가 넣은 것이라, 2라운드 test-strategy 리뷰를 거치지 않았습니다.

## spec.md 편집 목록

**편집 1 — 19행(SR-1.4) 비고 대조 문장**

- 바꿀 문장:
  `비고도 대장 본문이 원본이라 같은 테스트가 본다: `**` 를 지운 대장 전문에 대기 실시간 측정 비고 「실시간 측정값으로 확정 전 자료」가 부분 문자열로 있고, TourAPI 비고의 핵심어 「행마다 다르다」·「출처표시·변경금지」가 둘 다 있다. 상수에서 비고가 빈 문자열이 아닌 행은 정확히 넷(SR-1.2)이다.`
- 새 문장:
  `비고도 대장 본문이 원본이라 같은 테스트가 본다. 판정 값은 테스트 리터럴이 아니라 상수(`DATA_SOURCES`)에서 꺼낸다: ① 「대기 실시간 측정」 행의 상수 비고 전체가 `**` 를 지운 대장 전문의 부분 문자열이다 ② TourAPI 비고는 양쪽을 본다 — `**`·백틱을 지운 대장 전문에 「행마다 다르다」·「출처표시·변경금지」가 있고, 상수의 해당 행 비고마다 「행마다」·「출처표시·변경금지」가 있다 ③ 비고가 빈 문자열이 아닌 행의 데이터 이름 집합 == {정규화 전 대장 §1 라이선스 칸에 「(행마다」가 든 행의 데이터 이름(대장에서 꺼낸다)} ∪ {「대기 실시간 측정」}. 개수가 아니라 이름 집합으로 단언한다.`

**편집 2 — 43행(SR-5.4) 회귀 주입에 두 줄 추가**

- 바꿀 문장:
  `원천·라이선스 열 대조는 SR-1.4 상설 부정 테스트 ②③ 이 맡으므로 따로 주입하지 않는다.`
- 새 문장:
  `상수의 대기 실시간 측정 비고에서 한 글자 바꿈 → 게이트 빨강(SR-1.4 ①). 상수에서 TourAPI 비고 하나를 「관광지」 행으로 옮김 → 게이트 빨강(SR-1.4 ③). 원천·라이선스 열 대조는 SR-1.4 상설 부정 테스트 ②③ 이 맡으므로 따로 주입하지 않는다.`

**편집 3(선택) — 8행 개정 이력 끝에 한 문장 추가**

- 추가할 문장: `3라운드 심판(1건 유지, `context/review-verdict-round3.md`) 반영: 비고 대조를 상수 값 기준과 이름 집합 단언으로 바꾸고, 비고 축 회귀 주입 두 줄을 더함.`

## 사용자 판단 항목

없습니다. 편집 1·2를 이번 라운드에 반영하면 유지된 REVISE 가 닫히므로 BLOCK 으로 올라갈 항목이 남지 않습니다. 반영하지 않고 넘기면 T3-1 하나가 BLOCK 으로 사용자에게 갑니다.

SUMMARY: keep 1 / demote 0 / dismiss 0
NOTES: 스펙은 TourAPI 비고 세 행의 상수 문구가 서로 같아야 하는지를 정하지 않았다. 판정 대상이 아니라 기록만 해 둔다.

관련 파일:
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-08-place-trust-pages-etag/spec.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-08-place-trust-pages-etag/context/engineer-review-test-strategy-round3.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-08-place-trust-pages-etag/context/engineer-review-architecture-round3.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/architecture/data-sources.md
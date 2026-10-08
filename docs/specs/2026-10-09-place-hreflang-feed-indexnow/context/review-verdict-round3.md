**판정 결과: 7건 중 6건 유지(전부 REVISE), 1건 기각(R3-I4, 문장 부호 문제라 스타일).** 강등은 없습니다. 유지한 6건은 인용한 위치를 직접 열어 확인했고, 발견과 반대되는 표준·선례는 찾지 못했습니다. 이번이 마지막 라운드이므로 아래 편집 E13~E20을 반영하면 끝납니다.

## 판정 요약

| id | 차원 | 판정 | 등급 | 한 줄 |
|---|---|---|---|---|
| R3-I1 | implementation | 유지 | REVISE | spec.md:116에 실행 권한 지정이 없습니다. Dockerfile:80의 기존 `COPY`에도 모드 지정이 없고 레포에 선례가 없습니다. |
| R3-I2 | implementation | 유지 | REVISE | spec.md:116은 경로만 적고 하위 디렉터리여야 하는 이유는 적지 않았습니다. |
| R3-I3 | impl·usecase | 유지 | REVISE | spec.md:151은 「없어도 배포는 안전」이라고만 적었습니다. deployment.yaml:10은 replicas 1이고, Secret 변경을 감지해 재시작하는 장치가 없습니다. |
| R3-I4 | implementation | 기각 | MINOR | 문장 부호만 고치는 지적이라 헌법 5(스타일)에 해당합니다. 고치는 것은 막지 않습니다. |
| R3-S1 | security | 유지 | REVISE | spec.md:116은 정규식만 적었고, 값 전체에 맞춰 보라는 조건이 없습니다. |
| R3-U1 | usecase | 유지 | REVISE | 부록 C 4단계가 「3단계로 되돌린다」고 적었는데, 되돌리기는 5단계입니다. |
| R3-T1 | test-strategy | 유지 | REVISE | spec.md:119의 검증 세 경우가 SR-5.1과 SR-5.2 어디에도 없습니다. 기존 검사 스크립트는 템플릿만 마운트하고 entrypoint 스크립트는 마운트하지 않습니다. |

## 발견별 판정

```json
[
  { "id": "R3-I1 entrypoint 스크립트 실행 비트",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 116, "quote": "`portal-fe` 이미지에 `/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)를 넣는다." },
      { "file": "portal-fe/Dockerfile", "line": 80, "quote": "COPY nginx.conf /etc/nginx/templates/default.conf.template" } ],
    "reason": "스펙에 실행 권한 지정이 없고 기존 COPY 관례에도 모드 지정이 없습니다. 반증(ⓐⓑⓒ)이 없어 유지합니다." },
  { "id": "R3-I2 하위 디렉터리여야 하는 이유",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 116, "quote": "`/etc/nginx/conf.d/indexnow/indexnow.conf` 조각을 쓴다" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 119, "quote": "넓은 정규식(`\\.txt$`)·디렉터리 마운트 금지." } ],
    "reason": "경로는 정했지만 이유가 없습니다. 구현자가 conf.d/ 바로 아래로 옮기면 http 블록이 조각을 읽어 nginx 기동이 실패합니다. 이 실패를 막는 문장이 스펙에 없어 유지합니다." },
  { "id": "R3-I3 Secret 을 늦게 만들면 재시작 필요",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 151, "quote": "Secret `place-indexnow` 생성(사용자, OCI — 없어도 배포는 안전하고 키 파일만 없다)" },
      { "file": "k8s/base/portal-fe/deployment.yaml", "line": 10, "quote": "replicas: 1" } ],
    "reason": "env secretKeyRef 와 entrypoint 조각은 기동할 때 한 번만 적용됩니다. 재시작 절차가 스펙에 없고 반증도 없습니다." },
  { "id": "R3-I4 E9 자리 문장 부호",
    "verdict": "dismiss", "severity": "MINOR",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 53, "quote": "로그 N 은 켜짐과 같음) 구현 커밋에서 … 켜기·되돌리기는 부록 C.." } ],
    "reason": "마침표 누락·중복은 표기 문제라 헌법 5(스타일)로 기각합니다. 요구 내용은 지금 문장으로도 읽힙니다." },
  { "id": "R3-S1 키 형식 검사는 값 전체에",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 116, "quote": "`INDEXNOW_KEY` 가 `^[0-9a-f]{32}$` 에 맞을 때만" },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 119, "quote": "형식 틀린 키(`;` 포함) → 조각 없음·기동" } ],
    "reason": "줄 단위로 맞춰 보는 구현을 막는 문장이 없고, 검증에도 여러 줄 값 경우가 없습니다. 검사의 목적(설정 주입 차단)이 구현 형태에 달려 있어 유지합니다." },
  { "id": "R3-U1 부록 C 4단계 되돌리기 단계 번호",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 225, "quote": "범위 다름이 1건이라도 나오면 3단계로 되돌린다." },
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 226, "quote": "5. 되돌리기: `\"false\"` 로 커밋 → 재색인 → **portal-fe 를 다시 빌드·배포**해" } ],
    "reason": "가리키는 단계 번호가 틀렸다는 것을 원문으로 확인했습니다. 그대로 따르면 스위치가 켜진 채 남습니다." },
  { "id": "R3-T1 키 파일 검증 하네스·회귀 주입 부재",
    "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md", "line": 119, "quote": "검증: 키 없음 → nginx 기동·키 파일 없음, 형식 틀린 키(`;` 포함) → 조각 없음·기동, 정상 키 → 200·본문 = 키." },
      { "file": "portal-fe/scripts/check-nginx-events-sitemap.sh", "line": 83, "quote": "-v \"$WORK/default.conf.template:/etc/nginx/templates/default.conf.template:ro\" \\" } ],
    "reason": "SR-5.1과 SR-5.2에 이 세 경우가 없습니다. 기존 검사를 그대로 베끼면 entrypoint 스크립트 없이 nginx 를 재게 되어 「키 없음 → 기동」만 초록이 됩니다. 반증이 없어 유지합니다." }
]
```

## spec.md 편집 목록

**E13 (R3-I1·I2·S1)**: SR-4.2 첫 하위 항목을 통째로 바꿉니다.

바꿀 문장은 `` - `portal-fe` 이미지에 `/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)를 넣는다. `INDEXNOW_KEY` 가 `^[0-9a-f]{32}$` 에 맞을 때만 `/etc/nginx/conf.d/indexnow/indexnow.conf` 조각을 쓴다. 비었거나 형식이 다르면 조각을 쓰지 않고 경고 한 줄을 남긴다(키 값은 찍지 않는다). `` 입니다.

새 문장:
```text
   - `portal-fe` 이미지에 `/docker-entrypoint.d/` 스크립트(20-envsubst 보다 앞 번호)를 실행 권한째 넣는다(`COPY --chmod=0755` 또는 레포 파일 모드 100755 — 실행 비트가 없으면 엔트리포인트가 오류 없이 건너뛰어 키 파일만 조용히 빠진다). `INDEXNOW_KEY` 가 값 전체로 32자 소문자 hex 일 때만 `/etc/nginx/conf.d/indexnow/indexnow.conf` 조각을 쓴다 — 검사는 `${#k} -eq 32` 와 `case "$k" in *[!0-9a-f]*) 거부` 를 함께 쓰고, 줄 단위 `grep` 은 쓰지 않는다(여러 줄 값의 첫 줄만 맞춰 보고 통과시킨다). 조각은 하위 디렉터리에 둔다 — `conf.d/` 바로 아래 `*.conf` 는 http 블록이 읽어 `location` 이 server 밖에 놓이고 nginx 기동이 실패한다. 비었거나 형식이 다르면 조각을 쓰지 않고 경고 한 줄을 남긴다(키 값은 찍지 않는다).
```

**E14 (R3-S1)**: SR-4.2 마지막 하위 항목에 있는 검증 문장을 바꿉니다.

바꿀 문장은 `` 형식 틀린 키(`;` 포함) → 조각 없음·기동, `` 입니다.

새 문장:
```text
형식 틀린 키(`;` 포함 · 첫 줄은 정상 키인 여러 줄 값 · 끝 개행 포함) → 조각 없음·기동, 
```

**E15 (R3-T1)**: SR-5.1 목록에서 `` `place/ingest/tests/indexnow_test.py` `` 항목(두 줄) 바로 뒤에 아래 항목을 더합니다.
```text
   - `portal-fe/scripts/check-nginx-indexnow.sh`(`check-nginx-events-sitemap.sh` 와 같은 방식, 실제 nginx 이미지) — 레포의 실제 entrypoint 스크립트를 실행 권한째 `/docker-entrypoint.d/` 에 마운트하고 `-e INDEXNOW_KEY` 를 바꿔 가며 ① 미설정 → 기동·`/{임의hex}.txt` 응답이 키 본문 아님 ② `;` 포함·여러 줄(첫 줄 정상) → 조각 없음·기동 ③ 정상 → place 호스트 200·본문 = 키·`Cache-Control` 한 벌, apex·blog 호스트 404.
```

**E16 (R3-T1)**: SR-5.2 회귀 주입 목록 끝을 바꿉니다.

바꿀 문장은 `` 짝 스위치 분기 삭제(꺼져도 `alternateId` 를 실음 — 「꺼짐 → 모든 문서 null」 테스트가 잡는다). `` 입니다.

새 문장:
```text
짝 스위치 분기 삭제(꺼져도 `alternateId` 를 실음 — 「꺼짐 → 모든 문서 null」 테스트가 잡는다) · 키 형식 검사를 줄 단위 `grep` 으로 바꾸기(`check-nginx-indexnow.sh` ② 가 잡는다).
```

**E17 (R3-I3)**: SR-5.3 괄호 안을 바꿉니다.

바꿀 문장은 `(사용자, OCI — 없어도 배포는 안전하고 키 파일만 없다)` 입니다.

새 문장:
```text
(사용자, OCI — 없어도 배포는 안전하고 키 파일만 없다. portal-fe 배포 뒤에 만들었으면 `ssh msa-oci` 에서 `kubectl -n commerce rollout restart deploy/portal-fe` — env 와 조각은 기동 때 한 번만 읽힌다. place-ingest 는 CronJob 실행마다 읽어 재시작이 필요 없다)
```

**E18 (R3-I3)**: 부록 B 1단계를 바꿉니다.

바꿀 문장은 `` 1. 배포 뒤 `https://place.1989v.com/{key}.txt` 200·본문 = 키 확인. `` 입니다.

새 문장:
```text
1. 배포 뒤 `https://place.1989v.com/{key}.txt` 200·본문 = 키 확인. 키 본문이 아니면 Secret 존재 여부와 Secret 생성 뒤 portal-fe 재시작 여부(SR-5.3)를 확인한다.
```

**E19 (R3-U1)**: 부록 C 4단계에서 단계 번호를 바꿉니다.

바꿀 문장은 `범위 다름이 1건이라도 나오면 3단계로 되돌린다.` 입니다.

새 문장:
```text
범위 다름이 1건이라도 나오면 5단계로 되돌린다.
```

**E20 (R3-I4, 기각했지만 고쳐도 됨)**: 바꿀 문장은 `` 로그 N 은 켜짐과 같음) 구현 커밋에서 `` 와 `` 부록 C.. `` 입니다. 각각 `로그 N 은 켜짐과 같음). 구현 커밋에서`, `부록 C.` 로 고칩니다. 판정에는 영향이 없습니다.

## 사용자가 정할 것

1. **조각에 `X-Robots-Tag` 헤더를 함께 둘지 (리뷰어가 선택으로 남긴 항목이라 판정 대상은 아닙니다)**
   - 조각 안에 `add_header` 가 있어서 server 레벨 `X-Robots-Tag` 가 상속되지 않습니다.
   - place 호스트에서는 그 값이 빈 문자열이라 지금은 동작 차이가 없습니다.
   - 권고 기본값은 **넣지 않는 것**입니다(최소 수정). 다른 호스트 조각과 형태를 맞추고 싶을 때만 `add_header X-Robots-Tag $host_robots_tag always;` 를 더합니다.
2. **E20을 반영할지**: 권고 기본값은 반영입니다. 비용이 거의 없고 판정에는 무관합니다.

SUMMARY: keep 6 / demote 0 / dismiss 1

NOTES: R3-I1과 R3-I2의 nginx 동작(실행 비트가 없는 스크립트를 건너뜀, conf.d 바로 아래 *.conf만 http 블록이 include)은 공식 nginx 이미지 기준의 일반 지식으로 판정했고, 레포 안에서 반증을 찾지 못했습니다. 실측은 E15의 검사 스크립트가 맡습니다.

참고 경로:
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-hreflang-feed-indexnow/spec.md
- /private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-hreflang-feed-indexnow/context/engineer-review-round3.md
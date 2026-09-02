---
name: blog-post
description: blog.1989v.com 에 올릴 글을 쓰고, 검사하고, DB 에 넣는다. "블로그 글 써줘", "이거 포스팅해줘", "블로그에 올려줘", "글 초안 만들어줘" 같은 요청에 반응. 기존 글 수정도 이 스킬로.
argument-hint: [주제 | 초안 경로 | 글 id]
---

# 블로그 글 작성

`blog.1989v.com` 글의 작성·검사·발행을 한 흐름으로 처리한다.

## 시작할 때 반드시

1. **`docs/conventions/blog-writing.md` 를 읽는다.** 문체·구조·금칙의 단일 원본이다.
   이 스킬은 그 내용을 복사하지 않는다.
2. 그림이 필요하면 **`blog-diagram` 스킬**을 부른다.

## 이 블로그가 아닌 것

**작업 일지가 아니다.** 옵시디언 노트를 옮기면 판올림 이력·시도와 실패·의사결정·경위가
딸려 온다. 읽는 사람은 기능을 알러 왔지 남의 일지를 읽으러 오지 않았다.

| 이건 어디로 | |
|---|---|
| 판올림 이력 | 릴리스 노트 |
| 시도와 실패 | 커밋 메시지 |
| 왜 그렇게 정했나 | ADR (`docs/adr/`) |
| 작업 경위·회고 | 옵시디언 |

설계 이유가 정보로서 필요하면 **결과 문장 뒤 한 줄**로 붙인다. 서사로 풀지 않는다.

## 순서

1. **무엇을 전달하는 글인지 한 줄로 적는다.** 그 줄이 `summary` 가 된다.
   "X 를 만든 이야기" 면 다시 적는다 — "X 는 무엇이고 어떻게 쓰나" 여야 한다.

2. **요약 표를 먼저 쓴다.** 리드 두 문장 다음, 첫 h2 앞. 목차가 아니라 **답**을 담는다.
   설치·크기·지원 범위·제약처럼 독자가 가장 먼저 확인할 값이 여기 온다.

3. **h2 하나에 답 하나.** 각 절은 표·코드 블록·목록 중 하나를 반드시 포함한다.
   산문만 여섯 줄 넘으면 옮길 것이 남아 있다는 뜻이다(W4 가 잡는다).

4. **코드 이야기면 코드 블록을 낸다.** 설명 문단 세 개보다 여덟 줄짜리 블록이 빠르다.
   언어를 표시한다(` ```ts `). `<pre><code>` 로 렌더되고 가로 스크롤이 걸린다.
   명령은 ` ```bash `, 설정은 ` ```json ` 또는 ` ```css `.

5. **`scripts/lint-blog-post.py <초안>` 을 돌린다.** FAIL 0 이어야 끝이다.
   `--strict` 로 WARN 까지 본다.

6. **DB 에 넣는다.** 본문의 원본은 레포가 아니라 DB 다(§6).
   한글은 **hex 로** 넣는다 — 리터럴은 조용히 이중 인코딩된다.

## 검사 코드

| 코드 | 검사 |
|---|---|
| F1 | front-matter 4필드 + 컬럼 상한 + slug 형식 |
| F2·F3·F4 | 문장 100자 · 문단 3문장 · 리드 2문장 |
| F5·F6 | 산문 물음표 없음 · 금칙 표현 없음 |
| F7 | 이력·의사결정·경위 서술 없음 |
| F8 | 첫 h2 앞에 요약 표 |
| W1~W4 | 평균 문장 길이 · 산문 비율 · 절당 산문량 · 절의 정보 밀도 |

## DB 반영

```bash
# 본문·요약을 hex 로 뽑는다
python3 - <<'PY'
import io, re
s = io.open('docs/drafts/<초안>.md', encoding='utf-8').read()
fm, body = s.split('---\n', 2)[1:]
body = body.lstrip('\n')
open('/tmp/body.hex','w').write(body.encode('utf-8').hex())
open('/tmp/summary.hex','w').write(re.search(r'^summary: (.+)$', fm, re.M).group(1).encode('utf-8').hex())
PY

BODY=$(cat /tmp/body.hex); SUMM=$(cat /tmp/summary.hex)
echo yes | ~/.local/bin/oci-mysql --write code_dictionary_db \
  "UPDATE blog_post SET body=CONVERT(0x${BODY} USING utf8mb4),
   summary=CONVERT(0x${SUMM} USING utf8mb4) WHERE id=<id>"
```

**반영 뒤 MD5 로 확인한다.** 이중 인코딩은 눈으로 안 보인다.

```bash
~/.local/bin/oci-mysql code_dictionary_db "SELECT MD5(body) FROM blog_post WHERE id=<id>"
```

로컬 값과 같아야 한다.

## 하지 않는 것

- 발행 상태를 **묻지 않고** 바꾸지 않는다. `DRAFT` → `PUBLISHED` 는 사용자 승인 사항이다.
- 초안 파일만 고치고 끝내지 않는다. 화면에 나가는 것은 DB 다.
- lint 를 건너뛰지 않는다. 빌드는 본문을 못 보므로 이게 유일한 게이트다.

## 관련

- `docs/conventions/blog-writing.md` — 문체·구조·금칙 (단일 원본)
- `docs/conventions/blog-writing.md` §7 — 본문 세로 리듬 (`.blog-body` 간격 토큰)
- `docs/conventions/blog-diagram.md` — 그림 삽입 규칙
- `docs/adr/ADR-0072-blog-platform.md` — 플랫폼 구조

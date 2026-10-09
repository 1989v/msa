# 배포 뒤 확인 — 묶음 공유 · GA 로더 (SR-4.4)

- 배포: 커밋 `0d7377f93`, 이미지 `0d7377f`(gateway·account·portal-fe), 2026-10-09 12:31 KST 롤아웃. 설정 `kgd.wishlist.share.enabled` 는 기본 false(켜지 않음)
- 방법: curl 만(브라우저 없음), GET 만
- 측정 대상 최신 여부: apex `https://1989v.com/` 의 번들 `/assets/index-Cm9QxGrC.js`(place 와 같은 해시), index.html 에 이번에 넣은 `%2Fshared%2F` 문자열 1건 → 유효
- 측정 시각: 2026-10-09 12:43:47 KST

## 판정 요약

| 항목 | 결과 | 판정 |
|---|---|---|
| 꺼짐: `GET /api/v1/wishlist/shared/abcdefghij` | 404 `application/json` | 통과 |
| 꺼짐: `GET /c/abcdefghij` | 404 `application/json`(302 아님) | 통과 |
| 두 응답 본문 동일 | 7개 응답 본문 md5 모두 `d8b32bc1d64736423fddb32ebfea15bb` | 통과 |
| 신원 헤더 위조(`X-User-Id`·`X-User-Roles`·`Authorization`) | 상태·본문 동일(404) | 통과 |
| 형식 밖 토큰(`/shared/x`·`/c/x`) | 같은 404·같은 본문(405 아님) | 통과 |
| GA 로더 조건 셋 | `/shared/` 경로 · `%2Fshared%2F`(i) · referrer 경로 `/shared/` 세 조건이 resume 제외 바로 다음 줄에 있음 | 통과 |
| GA 요청 0건(CDP, 세 경우 + 대조군) | — | **브라우저 확인 대기** |

본문이 게이트웨이 기본 404(타임스탬프 포함 JSON)가 아니라 `ApiResponse` 형식(`{"success":false,…,"code":"NOT_FOUND"}`)이다 — 라우트가 account 까지 닿아 UseCase 의 꺼짐 분기가 낸 404 로 읽힌다.

## 명령과 결과 줄

```bash
run(){ curl -s -m 20 -o f/b$i -D f/h$i "$@"; ... }   # 상태·content-type·Location·본문 앞 160자
run https://1989v.com/api/v1/wishlist/shared/abcdefghij
run -H 'X-User-Id: 1' -H 'X-User-Roles: ROLE_ADMIN' https://1989v.com/api/v1/wishlist/shared/abcdefghij
run -H 'Authorization: Bearer forged' https://1989v.com/api/v1/wishlist/shared/abcdefghij
run https://1989v.com/c/abcdefghij
run -H 'X-User-Id: 1' -H 'X-User-Roles: ROLE_ADMIN' https://1989v.com/c/abcdefghij
run https://1989v.com/api/v1/wishlist/shared/x
run https://1989v.com/c/x
md5 -q f/b1 … f/b7 | sort | uniq -c
```

```text
2026-10-09 12:43:47 KST
1  404 https://1989v.com/api/v1/wishlist/shared/abcdefghij ctype=application/json loc= body={"success":false,"data":null,"error":{"code":"NOT_FOUND","message":"리소스를 찾을 수 없습니다"}}
2  404 (X-User-Id·X-User-Roles 위조)        같은 본문
3  404 (Authorization: Bearer forged)       같은 본문
4  404 https://1989v.com/c/abcdefghij ctype=application/json loc= body={"success":false,"data":null,"error":{"code":"NOT_FOUND","message":"리소스를 찾을 수 없습니다"}}
5  404 (/c + X-User-Id·X-User-Roles 위조)   같은 본문
6  404 https://1989v.com/api/v1/wishlist/shared/x   같은 본문
7  404 https://1989v.com/c/x                        같은 본문
   7 d8b32bc1d64736423fddb32ebfea15bb
```

```bash
curl -s https://1989v.com/ -o apex-index.html
grep -n -E "googletagmanager|/shared/|%2Fshared%2F|referrer|resume" apex-index.html
```

```text
14:        if (host.split(".")[0] === "resume") return;
15:        if (/^\/shared\//.test(location.pathname) || /%2Fshared%2F/i.test(location.search) || /^[a-z][a-z0-9+.-]*:\/\/[^\/?#]+\/shared\//i.test(document.referrer)) return;
19:        tag.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
```

## 브라우저 확인 대기

SR-4.4 의 CDP 항목은 이번 확인에서 브라우저를 쓰지 않아 남았다. 문자열이 있다는 것은 조건이 실행된다는 증거가 아니다 — 아래를 CDP 로 재야 닫힌다.

- `googletagmanager.com` 요청 0건: ① `https://1989v.com/shared/x` ② `https://1989v.com/login?next=https%3A%2F%2F1989v.com%2Fshared%2Fx` 직접 열기 ③ `/shared/x` 에서 별 → `/login`
- 대조군 `https://1989v.com/` 에서 1건 이상

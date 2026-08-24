<!-- source: deal/domain/src/main/kotlin/com/kgd/deal/domain/model/Offer.kt -->

# Deal Service (혜택 링크 허브)

`deal.1989v.com` — 카테고리별 혜택 링크 큐레이션 + 자체 리다이렉터 + 클릭 계측 (ADR-0069).
신규 JVM 없이 **`code-dictionary:app` 에 폴드**된 라이브러리다 (ADR-0058 컨벤션).

## Modules

| Gradle path | 역할 |
|---|---|
| `:deal:domain` | Pure Kotlin 도메인 (`DealCategory`, `Offer`, `DealEnums`) |
| `:deal:feature` | 라이브러리(비-bootable) — 컨트롤러·서비스·JPA. 스키마는 code-dictionary 와 공유 |

FE 는 portal-fe `deal.1989v.com` (같은 번들·호스트 분기).

## Commands

```bash
./gradlew :deal:domain:test              # 도메인 테스트 (Spring context 없음)
./gradlew :deal:feature:test             # 서비스 단위
./gradlew :code-dictionary:app:build     # 호스트 앱 빌드 (deal 포함)
```

## Key Rules

- **규제 업권은 카테고리 행 자체를 만들지 않는다.** 의료·금융은 링크를 거는 것만으로
  의료법 27조(환자 유인·알선)·금소법 위반 소지가 있다. **"노출 안 함" 결정을 노출용 테이블에
  행으로 심지 말 것** — 행이 있으면 언젠가 누군가 켠다. 아예 만들지 않는 것이 방어다

- **`target_url` 은 원본 무변조로 302 한다.** 파라미터를 손대면 제휴 약관 위반이고 트래킹 쿠키가
  깨져 정산이 안 된다. 리다이렉터는 `/go/{slug}` 이고 gateway 가 받는다(아웃바운드)

- **링크 종류를 `AFFILIATE` / `PLAIN` 으로 가른다.** 고지 문구는 제휴에만 붙인다 —
  전부에 붙이면 고지가 배경이 되고, 안 붙이면 표시광고법 위반이다

- **색인 대상이 아니다 (noindex).** 링크 모음만으로 색인되면 thin affiliate 판정이
  **사이트 전체로 번진다.** blog·rank 와 반대 방향의 결정이고, `resume` 과 같은 기준이다

- **폴드 서비스라 세 곳을 함께 고쳐야 한다** — `scanBasePackages` / EMF `packages` /
  `@EnableJpaRepositories`. deal 출시 때 EMF 를 빠뜨렸다. 상세는 `code-dictionary/CLAUDE.md`

- **출시 때 이미지가 안 구워진 채 배포된 적이 있다** — 같은 커밋의 다른 서비스 테스트가 깨져
  `images.yml` 잡 전체가 죽었고, 매니페스트만 전진해 200 이 뜨니 배포된 것처럼 보였다.
  배포 확인은 커밋이 아니라 **태그**로 한다 (`k8s/CLAUDE.md`)

## Related

- ADR: `docs/adr/ADR-0069-deal-affiliate-hub.md`
- 스펙: `docs/specs/2026-08-19-deal-affiliate-hub/`
- 원장 보존기간(클릭 90일): `docs/adr/ADR-0077-ledger-retention.md` — **방침(`/privacy` §6)의
  숫자와 상수가 같아야 한다.** 한쪽만 고치면 개인정보처리방침이 거짓이 된다

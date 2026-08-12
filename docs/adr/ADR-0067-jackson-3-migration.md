# ADR-0067 — Jackson 2 를 걷어내고 Jackson 3 로 이관한다

- 상태: 채택 (2026-08-11)
- 관련: ADR-0019(배포 모드), ADR-0064(이력서)

## 맥락

Spring Boot 4.0.4 는 **Jackson 3(`tools.jackson`)를 MVC JSON 스택으로 자동 구성**한다.
그런데 플랫폼 코드는 여전히 Jackson 2(`com.fasterxml.jackson`)를 임포트한다 — 79개 파일,
13개 서비스. `common` 에는 그 간극을 메우는 브리지 빈이 있고, 주석이 스스로 임시임을 밝힌다:

> "Until the code migrates to `tools.jackson.databind.ObjectMapper`, this auto-configuration
> bridges the gap."

**이 과도기가 실제로 사고를 냈다.** 2026-08-11 어드민에서 기술을 추가할 때
`{"name":"kNN 벡터 검색","groupId":3}` 가 400 "요청 본문을 읽을 수 없습니다" 로 죽었다.
원인은 **Jackson 3 에 Kotlin 모듈이 붙어 있지 않아 Kotlin 기본 인자값이 무시된 것**이다.
클래스패스의 `jackson-module-kotlin` 은 Jackson 2 용이라 적용되지 않았다. 값이 빠진 non-null
`Int` 는 바인딩 자체가 실패했다. 다른 요청이 멀쩡했던 이유는 생략되는 필드가 모두 nullable
이었기 때문이고, 즉 **우연히 안 터지고 있었을 뿐이다.**

같은 함정을 이미 한 번 밟은 흔적도 있다. `game/feature/.../AdService.kt` 에
"plain ObjectMapper 는 조용히 실패한다"는 주석과 함께 `jacksonObjectMapper()` 를 쓰고 있다.
그때는 그 지점만 고쳤고 원인이 공유되지 않아 다시 밟았다.

또한 `jackson-module-kotlin` 을 선언한 7개 모듈 중 **실제로 등록하는 곳은 2곳뿐**이다.
나머지 5곳은 의존성만 있고 아무 데도 붙지 않은 죽은 선언이다.

### 왜 지금 옮기는가

이 레포는 **포트폴리오 목적**이다. 동작한다는 이유로 구세대 API 를 안고 있으면 그 자체가
부정적 신호로 읽힌다. "위험하니 나중에"가 만든 과도기가 방금 버그를 냈다는 사실이 그 판단을
뒷받침한다.

## 결정

**Jackson 2 사용을 전부 걷어내고 Jackson 3 로 이관한다.** `common` 의 레거시 브리지는
이관 완료 후 제거한다.

### 이관 내용 (공식 마이그레이션 가이드 기준)

| 항목 | 2.x | 3.x |
|---|---|---|
| 패키지·groupId | `com.fasterxml.jackson` | **`tools.jackson`** |
| 예외 | `JacksonException extends IOException` (checked) | **unchecked** (`RuntimeException`) |
| 매퍼 생성 | `ObjectMapper()` 가변 | **불변 + 빌더** — `JsonMapper.builder().build()` |
| jsr310 · jdk8 · parameter-names | 별도 모듈 등록 | **databind 에 내장** — 선언 제거 |
| Kotlin 모듈 | `com.fasterxml.jackson.module:jackson-module-kotlin` | **`tools.jackson.module:jackson-module-kotlin`** (여전히 필요) |
| BOM | — | `tools.jackson:jackson-bom` |

**예외 하나: `jackson-annotations` 는 그대로 `com.fasterxml.jackson.annotation` 이다.**
`@JsonProperty` 등 애너테이션 임포트는 바꾸지 않는다. 기계적 치환의 가장 흔한 함정이다.

### 정정 (2026-08-12) — 서드파티 경계는 불가피하지 않았다

최초 작성 시 "opensearch-java 와 spring-kafka 가 Jackson 2 로 빌드돼 있어 그 경계는 Jackson 2 를
유지할 수밖에 없다"고 적었다. **사실이 아니다.** 두 라이브러리 모두 Jackson 3 전용 대체 클래스를
이미 제공한다.

| 라이브러리 | 레거시(Jackson 2) | Jackson 3 |
|---|---|---|
| `opensearch-java` | `json.jackson.JacksonJsonpMapper` | **`json.jackson3.JacksonJsonpMapper`** (3.9.0+) |
| `spring-kafka` | `JsonSerde` / `JsonDeserializer` | **`JacksonJsonSerde` / `JacksonJsonDeserializer`** |

Spring 이 HTTP 컨버터에서 쓴 명명 규칙(`MappingJackson2...` → `Jackson...`)이 그대로 적용돼 있었는데,
클래스 하나의 시그니처만 보고 라이브러리 전체가 Jackson 2 에 묶였다고 단정한 것이 원인이다.

**이 오판이 운영 장애로 이어졌다.** 경계를 Jackson 2 로 남긴 채 `common` 의 공유 `ObjectMapper` 빈만
Jackson 3 로 바꾸는 바람에, 그 빈을 주입받던 `place` 와 `analytics` 가 기동 실패(크래시루프)했다.
컨텍스트 로딩 테스트가 있는 모듈(gateway)에서는 배포 전에 잡혔지만, 없는 모듈은 배포 후에 드러났다.

교훈은 두 가지다.

1. **라이브러리가 새 세대를 지원하는지 먼저 확인한다.** 클래스 하나가 구세대 타입을 받는다고
   라이브러리 전체가 묶인 것은 아니다. 보통 새 클래스가 나란히 추가된다
2. **공유 빈의 타입을 바꾸면 모든 소비자가 함께 가야 한다.** 혼재를 남기면 컴파일은 통과하고
   기동에서 죽는다. 경계에서 공유 빈을 주입받지 말고 직접 생성하면 이 결합이 끊긴다

### 순서 — 서비스 단위로 쪼갠다

무료 티어 단일 노드다. 전 서비스 동시 롤아웃은 2026-08-09 전면 장애의 원인이었으므로
**한 번에 한 서비스씩** 배포한다.

1. **컨벤션 먼저** — 요청 DTO 의 선택 필드는 nullable 로 두고 기본값은 코드에서 정한다.
   와이어 포맷이 언어 기능(Kotlin 기본 인자)에 기대면 모듈 유무에 따라 조용히 깨진다.
   이 규칙은 이관과 무관하게 유효하며, **이관 없이도 이번 버그를 막을 수 있었다.**
2. **파일럿: `code-dictionary`** — 사고가 난 곳이자 이력서·게임이 얹힌 서비스. 여기서
   이관 절차를 확정한다.
3. **나머지 서비스** — `quant`(26) · `search`(15) · `inventory`(7) · `game`(7) · `analytics`(6)
   · `place`(5) · `order`(5) · `fulfillment`(5) · `agent-viewer`(5) 순으로 각각 별도 배포.
4. **정리** — `common` 의 `legacyObjectMapper` 브리지 제거, 죽은 `jackson-module-kotlin`
   선언 5곳 제거.

각 단계는 `:{service}:app:test` 통과를 증거로 남기고 넘어간다.

## 결과

- 요청 바인딩이 Kotlin 기본값·non-null 계약을 제대로 따른다
- 매퍼가 불변이라 런타임 재설정으로 인한 우발적 동작 변화가 사라진다
- 의존성이 줄어든다 — jsr310 등 3개 모듈 선언이 불필요해진다
- **되돌리기 어려운 변경이다.** 이관한 서비스는 Jackson 2 API 를 다시 쓸 수 없다
- 이관 중에는 서비스마다 Jackson 세대가 다른 기간이 생긴다. 브리지가
  `@ConditionalOnMissingBean` 이라 공존은 되지만, 이 기간을 길게 끌지 않는다

## 위험

**Kotlin 모듈이 붙으면 non-null 프로퍼티에 null 이 오는 요청을 거부하기 시작한다.**
지금 조용히 통과하던 호출이 400 으로 바뀔 수 있다 — 이는 잠복 버그가 드러나는 것이지
새로 생기는 것이 아니지만, **운영 중 서비스에서는 장애로 보인다.** 서비스별로 배포하고
직후 로그를 확인하는 이유가 이것이다.

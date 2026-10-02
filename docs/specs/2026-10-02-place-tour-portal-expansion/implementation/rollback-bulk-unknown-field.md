# 롤백 확인 — 옛 content 이미지의 bulk 가 모르는 필드를 받으면

판정: **무시한다(거부하지 않는다).** 새 수집기가 행사 날짜·목록 행 원문을 실어 보내도 옛 이미지는 그 키를 버리고 나머지를 적재한다.

## 근거

| 단계 | 위치 | 내용 |
|---|---|---|
| 요청 DTO | `place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt:13-20` | `BulkUpsertAttractionRequest` · `UpsertAttractionItem` 에 `@JsonIgnoreProperties` 가 없다 — 클래스 단위로 정한 것이 없어 매퍼 전역 설정을 따른다 |
| 엔드포인트 | `place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/controller/AttractionController.kt:41-48` | `@RequestBody` 로 Spring MVC 기본 JSON 변환기를 탄다. place·content 어디에도 `HttpMessageConverter` 재정의나 `JsonMapperBuilderCustomizer` 가 없다(`grep -rn "HttpMessageConverter\|configureMessageConverters\|JsonMapperBuilderCustomizer\|spring.jackson\|jackson:" place content common/src/main` 0줄) |
| 폴드 호스트 설정 | `content/app/build.gradle.kts:13` (`:place:feature` 를 담는다), `content/app/src/main/resources/application.yml` · `application-kubernetes.yml` | `spring.jackson.*` 설정 없음 |
| 공용 자동 설정 | `common/src/main/kotlin/com/kgd/common/jackson/CommonJacksonAutoConfiguration.kt:31-33` | `ObjectMapper()` 빈은 `@ConditionalOnMissingBean` 대체용이고 기능 플래그를 만지지 않는다 |
| Spring Boot | `gradle/libs.versions.toml:3` `springBoot = "4.0.4"` → `spring-boot-jackson-4.0.4.jar` | `JacksonAutoConfiguration` 과 내부 커스터마이저 클래스 바이트코드에 `FAIL_ON_UNKNOWN_PROPERTIES`·`DeserializationFeature` 참조가 0건(`javap -c -p` 로 확인) — Boot 가 이 값을 바꾸지 않는다 |
| Jackson | `tools.jackson.core:jackson-databind:3.1.0`(`:place:feature` runtimeClasspath) | `DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES.enabledByDefault()` = `false`, `JsonMapper.builder().build()` 에서도 `false`(jshell 로 실행 확인) |

## 롤백 때 데이터

- 옛 엔티티는 V23 컬럼을 매핑하지 않는다. Hibernate 는 매핑된 컬럼만 UPDATE 하므로 옛 이미지가 행을 고쳐도 V23 컬럼 값은 남는다.
- 다만 롤백 동안 수집 잡이 돌면 새 필드는 조용히 버려진다(오류가 나지 않아 눈에 띄지 않는다). SR-10 순서대로 `place-ingest-tour-sync` 를 먼저 suspend 하는 이유가 이것이다.
- 이 판정은 코드·라이브러리 기본값을 읽은 것이다. 옛 이미지에 실제 요청을 보내 본 것은 아니다.

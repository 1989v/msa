// ADR-0058 — inventory:app: 얇은 deployable aggregator.
// 도메인 로직은 feature 라이브러리에 있고, 여기는 @SpringBootApplication + 통합 yml 만.
// (배포 단위 이름은 아직 inventory — Phase 4 에서 order/fulfillment 폴드 후 commerce:app 으로 리네임)
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    // Kotlin 데이터 클래스 역직렬화 (ADR-0067). 없으면 Kotlin 기본값이 무시되고
    // 응답/요청에 빠진 non-null 필드에서 역직렬화가 실패한다.
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation(project(":inventory:feature"))
    implementation(project(":warehouse:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":fulfillment:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":order:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":product:feature")) // ADR-0093: 카탈로그 SSOT 폴드
    implementation(project(":deal:feature")) // ADR-0093 ②: 혜택 링크 허브 폴드 (전용 스키마 deal_db)
    implementation(project(":seller:feature")) // ADR-0099: 판매자(마켓플레이스) 폴드 (전용 스키마 seller_db)
    implementation(project(":payment:feature")) // ADR-0099: 결제(모의 PG·토스 어댑터) 폴드 (전용 스키마 payment_db)
    implementation(project(":promotion:feature")) // ADR-0099: 혜택(쿠폰·포인트·TCC 보류) 폴드 (전용 스키마 promotion_db)
    implementation(project(":settlement:feature")) // ADR-0099: 원장·정산 폴드 (전용 스키마 settlement_db)
    // 메인 클래스(@SpringBootApplication) 컴파일 + bootJar 구성용 최소 의존
    implementation(libs.spring.boot.starter.web)
    // 호스트의 @EnableKafka · 리스너 팩토리 auto-startup 적용 (CommerceApplication)
    implementation(libs.spring.kafka)
    // 추적 — HTTP·Kafka `traceparent` 전파와 로그 MDC 의 traceId. 내보내기(exporter)는 없다 — 전파와 로그 상관만 쓴다
    implementation("org.springframework.boot:spring-boot-micrometer-tracing-brave")
    implementation("io.micrometer:micrometer-tracing-bridge-brave")

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa) // dual-DS 테스트가 JpaRepository 타입 참조
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.testcontainers.junit) // ADR-0058: dual-datasource context-load 검증
    testImplementation(libs.testcontainers.mysql)
    // 아웃박스 릴레이 통합 검증 — 실제 브로커가 받은 바이트를 본다
    testImplementation(libs.testcontainers.kafka)
    testImplementation(project(":common"))
    // 컨텍스트 로드 spec 이 판매자 유스케이스 Command(도메인 enum 포함)를 직접 만든다
    testImplementation(project(":seller:domain"))
    // 컨텍스트 로드 spec 이 결제 상태(도메인 enum)를 값으로 판정한다
    testImplementation(project(":payment:domain"))
    // 혜택 통합 spec 이 쿠폰 줄(도메인 값 객체)·상태 enum 을 직접 쓴다
    testImplementation(project(":promotion:domain"))
    // 정산 E2E 가 정산서 상태·계정(도메인 enum)을 값으로 판정한다
    testImplementation(project(":settlement:domain"))
    // 주문서 통합 spec 이 거부 사유(도메인 enum)를 값으로 판정하고, 금액 백필 마이그레이션을 버전 지정으로 돌린다
    testImplementation(project(":order:domain"))
    testImplementation("org.flywaydb:flyway-core")
    testImplementation(libs.spring.kafka)
    // 운영 지표 게이지를 값으로 판정한다
    testImplementation("io.micrometer:micrometer-core")
}

tasks.bootJar {
    archiveBaseName.set("commerce")
}

// 사가 E2E 는 호스트 전체 컨텍스트에 리스너·릴레이·스케줄러를 전부 켠다 — 기본 512m 에서는 기동 중 GC 로 멈췄다
tasks.test {
    maxHeapSize = "1g"
}

// ADR-0058 — inventory:app: 얇은 deployable aggregator.
// 도메인 로직은 feature 라이브러리에 있고, 여기는 @SpringBootApplication + 통합 yml 만.
// (배포 단위 이름은 아직 inventory — Phase 4 에서 order/fulfillment 폴드 후 commerce:app 으로 리네임)
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":inventory:feature"))
    implementation(project(":warehouse:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":fulfillment:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":order:feature")) // co-deploy (commerce 모듈러 모놀리스)
    implementation(project(":game:feature")) // 웹 게임 아케이드(#23) co-deploy — Redis 전용, Tier B in-JVM(추가 프로세스 0)
    // 메인 클래스(@SpringBootApplication) 컴파일 + bootJar 구성용 최소 의존
    implementation(libs.spring.boot.starter.web)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.boot.starter.data.jpa) // dual-DS 테스트가 JpaRepository 타입 참조
    testImplementation(libs.kotest.extensions.spring)
    testImplementation(libs.testcontainers.junit) // ADR-0058: dual-datasource context-load 검증
    testImplementation(libs.testcontainers.mysql)
}

tasks.bootJar {
    archiveBaseName.set("commerce")
}

// 웹 게임 아케이드(#23) — game:web 브라우저 번들(game.js + index.html)을 정적 리소스로 패키징.
// commerce:app 이 /game/ 으로 서빙(API 는 /api/v1/game/**). game:web 변경 시에만 재빌드(up-to-date).
tasks.named<org.gradle.language.jvm.tasks.ProcessResources>("processResources") {
    dependsOn(":game:web:jsBrowserDistribution")
    from(project(":game:web").layout.buildDirectory.dir("dist/js/productionExecutable")) {
        into("static/game")
    }
}

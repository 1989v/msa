// Pure domain module — no Spring/JPA annotations in source.
// Depends on common for shared exception base classes, and spring-data-commons
// for Page/Pageable used in ProductSearchPort.
dependencies {
    implementation(project(":common"))
    implementation("org.springframework.data:spring-data-commons")
    // 테스트 전용 — 코스 구성 파서에 운영 표본 infoRaw 를 재색인과 같은 방식(Jackson)으로 풀어 넣는다
    testImplementation("tools.jackson.core:jackson-databind")
}

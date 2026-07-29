// Pure domain module — no Spring/JPA annotations in source.
// Depends on common only for shared exception base classes (BusinessException, ErrorCode).
// #23 흡수로 game:sim(KMP jvm) 이 추가됨 — 여전히 프레임워크 의존은 없다.
dependencies {
    implementation(project(":common"))
    // #23 흡수: 결정적 sim 코어(jvm variant) — 리플레이 검증 규칙이 사용
    implementation(project(":game:sim"))
}

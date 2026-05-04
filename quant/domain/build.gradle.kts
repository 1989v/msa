// Pure domain module — no Spring/JPA annotations in source.
// Depends on common only for shared exception base classes (BusinessException, ErrorCode).
dependencies {
    implementation(project(":common"))

    // UUID v7 generator (I3, 2026-05-05) — OrderId.newV7() 정통화. 라이브러리는 framework-free.
    implementation("com.fasterxml.uuid:java-uuid-generator:5.1.0")

    // Property-based domain invariant tests (TG-03). kotest-property is already
    // declared in the root version catalog but not wired into the subprojects
    // default testImplementation block, so we opt it in here explicitly.
    testImplementation(libs.kotest.property)
}

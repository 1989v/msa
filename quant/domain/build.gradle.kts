// Pure domain module — no Spring/JPA annotations in source.
// Depends on common only for shared exception base classes (BusinessException, ErrorCode).
dependencies {
    implementation(project(":common"))

    // Property-based domain invariant tests (TG-03). kotest-property is already
    // declared in the root version catalog but not wired into the subprojects
    // default testImplementation block, so we opt it in here explicitly.
    testImplementation(libs.kotest.property)
}

// Pure domain module — no Spring/JPA annotations in source.
// Depends on common only for shared exception base classes (BusinessException, ErrorCode).
dependencies {
    implementation(project(":common"))
}

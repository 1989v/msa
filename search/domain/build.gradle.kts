// Pure domain module — no Spring/JPA annotations in source.
// Depends on common for shared exception base classes, and spring-data-commons
// for Page/Pageable used in ProductSearchPort.
dependencies {
    implementation(project(":common"))
    implementation("org.springframework.data:spring-data-commons")
}

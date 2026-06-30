// 웹 게임 아케이드(#23) — game:domain: 순수 Kotlin 백엔드 도메인(엔티티/포트/검증 규칙).
// Spring/JPA 의존 금지. game:sim 의 결정적 코어(ReplayLog/GameModule/SimRunner)를 Tier B 검증에 사용.
dependencies {
    implementation(project(":common"))
    implementation(project(":game:sim")) // KMP jvm variant — ReplayLog/InputEvent/GameModule/SimRunner
}

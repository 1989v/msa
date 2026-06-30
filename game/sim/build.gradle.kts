// 웹 게임 아케이드(#23) — KMP 결정적 sim-core.
// 같은 정수-결정적 엔진을 두 타깃이 공유한다:
//   - jvm: commerce:app(game:feature) 의 Tier B 리플레이 검증 (추가 프로세스 0)
//   - js : 브라우저 플레이 (game:web) — 추후 추가
// 루트 build.gradle.kts subprojects{} 의 kotlin.jvm 일괄 적용에서 카브아웃됨(KMP 와 상호배타).
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    jvmToolchain(25)

    jvm {
        // 다른 모듈(JVM 24)과 바이트코드 정합 — root 의 jvmTarget 정책과 동일.
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_24)
        }
    }
    js(IR) {
        browser()
        binaries.library() // game:web(브라우저 플레이)이 소비 — 같은 결정적 코어
    }

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

// kotlin("test") + useJUnitPlatform() → JVM 타깃에서 JUnit5 자동 선택.
tasks.withType<Test>().configureEach { useJUnitPlatform() }

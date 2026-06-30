// 웹 게임 아케이드(#23) — game:web: Kotlin/JS 브라우저 클라이언트.
// game:sim 의 js 타깃(결정적 코어)을 그대로 소비 → 서버 Tier B 와 '같은 코드'로 플레이.
// 루트 subprojects{} 의 kotlin.jvm 일괄 적용에서 카브아웃됨(KMP/JS).
plugins {
    alias(libs.plugins.kotlin.multiplatform)
}

kotlin {
    js(IR) {
        browser {
            commonWebpackConfig {
                outputFileName = "game.js"
            }
        }
        binaries.executable()
    }
    sourceSets {
        jsMain.dependencies {
            implementation(project(":game:sim"))
            // kotlinx.browser / org.w3c.dom 은 Kotlin/JS stdlib 에서 제공(별도 dependency 불필요).
        }
    }
}

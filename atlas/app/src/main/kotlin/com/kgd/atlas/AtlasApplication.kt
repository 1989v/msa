package com.kgd.atlas

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0093 — atlas: apex 사이트의 총람. 개념 사전·서비스 카탈로그·포트폴리오·전시·이력서.
//
// 자기 도메인 없는 aggregator 가 아니라 **한 도메인(:code-dictionary:feature)만 링크한다** —
// 폴드돼 있던 넷(game·deal·ranking·blog)이 ②③ 에서 전부 떠났기 때문이다.
// 이름을 바꾼 이유는 남은 것이 「개념 사전」보다 넓어서다: 사전은 그중 하나이고,
// 포트폴리오·전시·이력서가 함께 apex 가 자기를 소개하는 면을 이룬다.
//
// 스키마 이름은 `code_dictionary_db` 그대로다. 파드 이름과 달리 스키마 개명은 기능 이득이
// 없고 실행 중 DB 를 건드리는 위험만 있다 — game_db 가 mysql-code-dictionary-master 에
// 사는 것과 같은 판단이다.
@SpringBootApplication(
    scanBasePackages = [
        "com.kgd.codedictionary",
        "com.kgd.common.exception",
        "com.kgd.common.response",
    ],
)
@EnableScheduling // 경량 스케줄 (ADR-0058: API JVM 코로케이트)
class AtlasApplication

fun main(args: Array<String>) {
    runApplication<AtlasApplication>(*args)
}

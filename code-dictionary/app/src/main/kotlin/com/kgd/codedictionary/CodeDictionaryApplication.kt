package com.kgd.codedictionary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0093: game:feature 는 content:app 으로 옮겼다 — 여기 스캔에서 빠졌다.
// ADR-0093 ②: deal:feature 는 commerce:app 으로 옮겼다 — 여기 스캔에서 빠졌다.
// ADR-0072: blog:feature 폴드 — com.kgd.blog 스캔 추가.
//   여기가 빠지면 컨텍스트는 정상적으로 뜨고 Flyway 도 돌지만 **컨트롤러가 하나도 매핑되지 않아**
//   그 도메인의 API 가 통째로 404 가 된다. 기동 실패가 아니라 조용한 404 라 배포 후에야 드러난다.
// ADR-0093 ②b: ranking:feature 는 content:app 으로 옮겼다 — 여기 스캔에서 빠졌다.
@SpringBootApplication(scanBasePackages = ["com.kgd.codedictionary", "com.kgd.blog", "com.kgd.common.exception", "com.kgd.common.response"])
@EnableScheduling // 경량 스케줄 (ADR-0058: API JVM 코로케이트)
class CodeDictionaryApplication

fun main(args: Array<String>) {
    runApplication<CodeDictionaryApplication>(*args)
}

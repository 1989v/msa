package com.kgd.game

import org.springframework.boot.autoconfigure.SpringBootApplication

/**
 * 라이브 E2E 전용 부트 앱 — game 모듈만 스캔.
 * commerce:app 에 폴드되는 것과 동일한 game 빈을 띄우되, 커머스 도메인(MySQL×4)은 제외.
 * 실제 Redis(testcontainers) + 임베디드 Tomcat 으로 HTTP 왕복을 검증한다.
 */
@SpringBootApplication(scanBasePackages = ["com.kgd.game"])
class GameItTestApp

package com.kgd.content

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// ADR-0093: content 모듈러 모놀리스 — 사람에게 보여 주는 것, 서브도메인으로 공개되는 도메인.
// 지금은 game(게임 플랫폼) + place(관광지·지리 SSOT) 둘이고, ②~③단계에서 스키마를 뗀
// blog·ranking 이 합류한다. 도메인별 datasource/EMF/TM 은 각 feature 의 설정이 배선한다
// (place 가 @Primary, game 은 비-@Primary 를 유지).
@SpringBootApplication(
    scanBasePackages = [
        "com.kgd.place",
        "com.kgd.game",
        "com.kgd.common.exception",
        "com.kgd.common.response",
    ],
)
// place 독립 앱의 PlaceApplication 이 @EnableConfigurationProperties(PlaceSeedProperties)
// 로 하던 것을 패키지 스캔으로 바꿨다 — 클래스를 import 하면 합성 루트가 남의 도메인을
// 부르는 것이 되어 교차 import 게이트(ADR-0083 ⑦)에 걸린다. 빠지면 시드 설정이 안 붙는다.
@ConfigurationPropertiesScan(basePackages = ["com.kgd.place"])
@EnableScheduling // game 주간 트렌딩 리셋 등 경량 스케줄
class ContentApplication

fun main(args: Array<String>) {
    runApplication<ContentApplication>(*args)
}

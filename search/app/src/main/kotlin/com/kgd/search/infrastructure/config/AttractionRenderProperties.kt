package com.kgd.search.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 관광지 서버 렌더 설정. 렌더 어댑터만 읽는다.
 *
 * @property shellUrl portal-fe 의 정적 셸. 프록시 경로(`/attractions/…`)로 잡으면
 *   search → portal-fe → search 순환이 된다 — `.html` 은 nginx 가 파일로 낸다.
 * @property origin canonical·JSON-LD 의 호스트. 요청 Host 로 만들지 않는다 — nginx 가 무엇을 넘기든
 *   출력이 바뀌지 않게.
 */
@ConfigurationProperties(prefix = "search.render")
data class AttractionRenderProperties(
    val shellUrl: String = "http://portal-fe/index.html",
    val origin: String = "https://place.1989v.com",
)

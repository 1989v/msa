package com.kgd.common.shortlink

import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity

/**
 * 단축 주소 해석의 302 응답. 상태가 없어 컨트롤러가 주입 없이 부른다 — 응답 조립은 presentation 의 일이고,
 * application 은 목적지 문자열만 돌려준다.
 */
object ShortLinkRedirects {

    fun redirect(location: String): ResponseEntity<Void> =
        ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.LOCATION, location)
            // 302 가 캐시되면 대상이 폐기·비공개로 바뀌어도 옛 목적지로 계속 나간다.
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            // 공유되는 주소라 외부에서 발견되기 쉽다. 단축 주소 자체가 색인되지 않게 한다.
            .header("X-Robots-Tag", "noindex, nofollow")
            .build()
}

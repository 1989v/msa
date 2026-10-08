package com.kgd.search.infrastructure.client

import com.kgd.search.application.attraction.port.CategoryCode
import com.kgd.search.application.attraction.port.CategoryCodePort
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * place 의 분류 코드표를 받는다. 캐시·주기 갱신·실패 처리는 부르는 쪽(분류 사전 서비스)이 갖는다 —
 * 여기서는 실패를 삼키지 않고 그대로 던진다.
 */
@Component
class CategoryCodeAdapter(
    @Value("\${search.category-lexicon.base-url:http://content:8097}") private val baseUrl: String,
    @Value("\${search.category-lexicon.enabled:true}") private val enabled: Boolean,
) : CategoryCodePort {

    private val client: RestClient = RestClient.builder()
        .baseUrl(baseUrl)
        .requestFactory(
            org.springframework.http.client.SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(2))
                setReadTimeout(Duration.ofSeconds(5))
            },
        )
        .build()

    /** 꺼져 있으면 빈 목록 — 서비스는 이것을 「못 받음」으로 보고 사전을 바꾸지 않는다. */
    override fun codes(): List<CategoryCode> {
        if (!enabled) return emptyList()
        val response = client.get().uri("/api/places/attractions/category-codes")
            .retrieve().body(CodesResponse::class.java) ?: return emptyList()
        return response.data.map { CategoryCode(lang = it.lang, code = it.code, depth = it.depth, name = it.name) }
    }

    data class CodesResponse(val data: List<Row> = emptyList())

    data class Row(val lang: String = "", val code: String = "", val depth: Int = 0, val name: String = "")
}

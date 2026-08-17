package com.kgd.search.opensearch

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * OpenSearch 클라이언트가 쓰는 매퍼의 **스트리밍 역직렬화 계약** 회귀 테스트.
 *
 * Jackson 3 은 `FAIL_ON_TRAILING_TOKENS` 가 기본 활성이다. opensearch-java 는 검색 응답
 * 안쪽의 부분 객체를 파서 위치에서 읽어가므로, 이 기능이 켜져 있으면 바깥 구조에 남은
 * 토큰이 트레일링으로 잡혀 모든 검색이 500 으로 죽는다. 실제로 그렇게 죽은 적이 있다.
 *
 * 컴파일로는 잡히지 않고 운영에서만 드러나는 종류라 테스트로 못박는다.
 */
class OpenSearchMapperTrailingTokenTest : BehaviorSpec({

    data class Doc(val id: String, val title: String)

    given("OpenSearchConfig 와 같은 방식으로 만든 매퍼") {
        val mapper = jacksonMapperBuilder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .build()

        `when`("검색 응답처럼 바깥 구조에 둘러싸인 문서를 파서 위치에서 읽으면") {
            // {"_source": {...}, "sort": [...]} 에서 _source 만 읽고 멈추는 상황을 재현한다.
            val json = """{"_source":{"id":"1","title":"경복궁"},"sort":[1.0]}"""
            val parser = mapper.createParser(json)
            parser.nextToken() // START_OBJECT
            parser.nextToken() // PROPERTY_NAME "_source"
            parser.nextToken() // START_OBJECT

            val doc = mapper.readValue(parser, Doc::class.java)

            then("남은 토큰이 있어도 실패하지 않는다") {
                doc.id shouldBe "1"
                doc.title shouldBe "경복궁"
            }
        }
    }
})

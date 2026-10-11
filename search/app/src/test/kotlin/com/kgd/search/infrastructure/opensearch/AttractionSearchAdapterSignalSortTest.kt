package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.AttractionSignalSort
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.data.domain.PageRequest
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 찜순·클릭순 — 하한 이상 문서만, 값 내림차순. 판정은 어댑터가 낸 요청 JSON 이다: 정렬 절의 필드·방향, 그리고 `range`
 * 를 이 테스트의 작은 해석기로 읽어 **리터럴 값**(찜 2·3, 클릭 4·5)을 넣어 본다 — 하한을 한 칸 내리거나 gte↔gt 를 바꾸면
 * 경계 값에서 어긋난다. 이 정렬이 없는 요청에는 두 필드가 나오지 않는다.
 * (OpenSearch 3.8 에서 index:false + doc_values 정수 필드에 range·정렬이 듣는 것은 로컬 컨테이너로 확인했다 —
 * `docs/specs/2026-10-10-place-visits-and-access/verifications/regression-injection.md`.)
 */
class AttractionSearchAdapterSignalSortTest : BehaviorSpec({
    val json = ObjectMapper()

    fun mainRequest(query: AttractionSearchPort.SearchQuery): JsonNode {
        val (a, captured) = AttractionSearchRequestSnapshots.adapter()
        a.search(query, PageRequest.of(0, 6))
        return json.readTree(captured.main.single().toJsonString())
    }

    /** 요청 안의 모든 `range` 절 — 필드 이름 → 조건. */
    fun ranges(node: JsonNode): Map<String, JsonNode> = buildMap {
        fun walk(n: JsonNode) {
            if (n.isObject) n.properties().forEach { (k, v) -> if (k == "range") v.properties().forEach { (f, c) -> put(f, c) }; walk(v) }
            if (n.isArray) n.forEach(::walk)
        }
        walk(node)
    }

    /** range 조건 하나가 값을 통과시키나 — gte·gt 만 본다(이 정렬이 쓰는 모양). 값이 없으면 통과하지 않는다. */
    fun admits(condition: JsonNode, value: Int?): Boolean {
        if (value == null) return false
        condition["gte"]?.let { if (value < it.asInt()) return false }
        condition["gt"]?.let { if (value <= it.asInt()) return false }
        return true
    }

    given("sort=saved") {
        val root = mainRequest(AttractionSearchPort.SearchQuery(lang = "ko", sidoCode = "11", sigunguCode = "110", signalSort = AttractionSignalSort.SAVED))
        then("savedCount 내림차순, 같으면 idSort·id 오름차순") {
            val sort = root["sort"]
            sort.size() shouldBe 3
            sort[0]["savedCount"]["order"].asString() shouldBe "desc"
            sort[1]["idSort"]["order"].asString() shouldBe "asc"
            sort[2]["id"]["order"].asString() shouldBe "asc"
        }
        then("찜 2명은 빠지고 3명은 들어온다 · 값 없는 문서도 빠진다") {
            val cond = ranges(root).getValue("savedCount")
            admits(cond, 2) shouldBe false
            admits(cond, 3) shouldBe true
            admits(cond, null) shouldBe false
            ranges(root).containsKey("uniqueClickers14d") shouldBe false
        }
    }

    given("sort=clicked") {
        val root = mainRequest(AttractionSearchPort.SearchQuery(lang = "ko", signalSort = AttractionSignalSort.CLICKED))
        then("uniqueClickers14d 내림차순") {
            root["sort"][0]["uniqueClickers14d"]["order"].asString() shouldBe "desc"
        }
        then("클릭 4명은 빠지고 5명은 들어온다") {
            val cond = ranges(root).getValue("uniqueClickers14d")
            admits(cond, 4) shouldBe false
            admits(cond, 5) shouldBe true
            ranges(root).containsKey("savedCount") shouldBe false
        }
    }

    given("근거 정렬이 없는 요청") {
        then("두 필드가 요청에 없다") {
            val text = mainRequest(AttractionSearchPort.SearchQuery(lang = "ko")).toString()
            text.contains("savedCount") shouldBe false
            text.contains("uniqueClickers14d") shouldBe false
        }
    }

    given("벡터와 함께") {
        then("줄 수 없다 — 하이브리드 질의에는 정렬을 걸 수 없다") {
            shouldThrow<IllegalArgumentException> {
                AttractionSearchPort.SearchQuery(keyword = "한옥", embedding = listOf(1f), signalSort = AttractionSignalSort.SAVED)
            }
        }
    }
})

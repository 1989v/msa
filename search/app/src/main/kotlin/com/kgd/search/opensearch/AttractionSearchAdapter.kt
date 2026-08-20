package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.Jamo
import com.kgd.search.domain.attraction.model.SuggestHit
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch._types.query_dsl.Operator
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

@Component
class AttractionSearchAdapter(
    private val client: OpenSearchClient,
    private val ranking: AttractionRankingProperties,
) : AttractionSearchPort {

    companion object {
        const val INDEX = "attractions"
        const val REGIONS_INDEX = "regions"

        /** 자동완성에서 지역이 차지하는 상단 슬롯 수 — "서울" 같은 지역 질의 우선 노출 */
        private const val SUGGEST_REGION_SLOTS = 3

        /** 키워드 매칭 대상 — ko(nori)/en(english) 서브필드 동시 커버 (문서 단위 lang 분리, ADR-0065). */
        private val KEYWORD_FIELDS = listOf(
            "title^3", "title.en^3", "overview", "overview.en", "address", "address.en",
        )
        private const val EARTH_RADIUS_KM = 6371.0
    }

    override fun search(
        query: AttractionSearchPort.SearchQuery,
        pageable: Pageable,
    ): Page<AttractionSearchPort.AttractionHit> {
        val request = buildRequest(query, pageable)
        val response = client.search(request, AttractionSearchDocument::class.java)
        val content = response.hits().hits().mapNotNull { hit ->
            hit.source()?.let { source ->
                val document = source.toDomain()
                AttractionSearchPort.AttractionHit(
                    document = document,
                    score = hit.score() ?: 0.0,
                    distanceKm = query.geo?.let {
                        haversineKm(it.latitude, it.longitude, document.latitude, document.longitude)
                    },
                )
            }
        }
        return PageImpl(content, pageable, response.hits().total()?.value() ?: 0L)
    }

    override fun findById(id: String): AttractionDocument? {
        val response = client.get({ g -> g.index(INDEX).id(id) }, AttractionSearchDocument::class.java)
        return if (response.found()) response.source()?.toDomain() else null
    }

    /**
     * 통합 자동완성 — 지역(상단 슬롯, 인구 log1p 부스트) + 관광지(prefix, lang 필터).
     * match_bool_prefix 라 별도 completion 매핑 없이 동작한다 (products suggest 패턴).
     */
    override fun suggest(prefix: String, lang: String?, size: Int): List<SuggestHit> {
        val regionSlots = minOf(SUGGEST_REGION_SLOTS, size)
        val regions = suggestRegions(prefix, lang, regionSlots)
        val attractions = suggestAttractions(prefix, lang, size - regions.size)
        return regions + attractions
    }

    private fun suggestRegions(prefix: String, lang: String?, size: Int): List<SuggestHit> {
        if (size <= 0) return emptyList()
        val request = SearchRequest.Builder()
            .index(REGIONS_INDEX)
            .query { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.should { s -> s.matchBoolPrefix { it.field("nameKo").query(prefix) } }
                            b.should { s -> s.matchBoolPrefix { it.field("name").query(prefix) } }
                            b.minimumShouldMatch("1")
                        }
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("population").factor(1.0f)
                                .modifier(FieldValueFactorModifier.Log1p).missing(0.0)
                        }
                        fn.weight(1.0f)
                    }
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .size(size)
            .build()
        return client.search(request, RegionSearchDocument::class.java).hits().hits().mapNotNull { hit ->
            hit.source()?.let { doc ->
                SuggestHit(
                    type = SuggestHit.Type.REGION,
                    id = doc.id,
                    title = if (lang == "en") doc.name else doc.nameKo ?: doc.name,
                    latitude = doc.location?.lat,
                    longitude = doc.location?.lon,
                    regionLevel = doc.level,
                )
            }
        }
    }

    private fun suggestAttractions(prefix: String, lang: String?, size: Int): List<SuggestHit> {
        if (size <= 0) return emptyList()
        val titleField = if (lang == "en") "title.en" else "title"
        /*
         * 세 신호를 **가중치로 눌러** 섞는다. must 가 아니라 should + minimumShouldMatch(1) 인 이유:
         * 자모로만 맞는 입력("경보")을 must 가 걸러버리면 자모 색인이 아무 일도 하지 못한다.
         *
         *  ×6  이름이 입력으로 시작        `경복궁` vs `한복남 경복궁점`
         *  ×1  형태소 기준 일반 매칭        기존 동작
         *  ×0.3 자모(조합 중간 상태)        `경보` → `ㄱㅕㅇㅂㅗ`
         *
         * 자모를 낮게 두는 건 그게 **가장 헐거운 신호**라서다. 같은 무게로 두면 자모로만 스치는
         * 문서가 이름이 정확히 맞는 문서를 밀어낸다 — 자동완성에서 제일 나쁜 실패다.
         */
        val matched = Query.of { q ->
            q.bool { b ->
                b.should { s -> s.matchBoolPrefix { it.field(titleField).query(prefix).boost(1.0f) } }
                /*
                 * 분류 가중치만으로는 "경복" 에서 `한복남 경복궁점` 을 못 내린다 — 그 상점의
                 * TourAPI 분류가 `culture` 라 경복궁과 같은 가중치를 받기 때문이다. 분류 체계가
                 * 새는 지점이고, 거기에 맞서는 신호는 분류가 아니라 **이름의 모양**이다.
                 */
                b.should { s -> s.prefix { p -> p.field("title.keyword").value(prefix).boost(6.0f) } }
                b.should { s ->
                    s.match { m ->
                        m.field("titleJamo")
                            .query(FieldValue.of(Jamo.decompose(prefix)))
                            // 여러 단어를 쳤으면 전부 맞아야 한다 — 하나만 스친 결과가 올라오면
                            // 자모의 헐거움이 그대로 순위에 샌다.
                            .operator(Operator.And)
                            .boost(0.3f)
                    }
                }
                b.minimumShouldMatch("1")
                lang?.let { l -> b.filter { f -> f.term { it.field("lang").value(FieldValue.of(l)) } } }
                b
            }
        }
        val request = SearchRequest.Builder()
            .index(INDEX)
            .query(withCategoryWeights(matched))
            .size(size)
            .build()
        return client.search(request, AttractionSearchDocument::class.java).hits().hits().mapNotNull { hit ->
            hit.source()?.let { doc ->
                SuggestHit(
                    type = SuggestHit.Type.ATTRACTION,
                    id = doc.id,
                    title = doc.title,
                    latitude = doc.location.lat,
                    longitude = doc.location.lon,
                    category = doc.category,
                )
            }
        }
    }

    private fun buildRequest(query: AttractionSearchPort.SearchQuery, pageable: Pageable): SearchRequest {
        val matched = Query.of { q ->
            q.bool { b ->
                    val keyword = query.keyword
                    if (keyword != null) {
                        b.must { m -> m.multiMatch { mm -> mm.query(keyword).fields(KEYWORD_FIELDS) } }
                    } else {
                        b.must { m -> m.matchAll { it } }
                    }
                    query.lang?.let { lang ->
                        b.filter { f -> f.term { it.field("lang").value(FieldValue.of(lang)) } }
                    }
                    query.areaCode?.let { area ->
                        b.filter { f -> f.term { it.field("areaCode").value(FieldValue.of(area)) } }
                    }
                    // 법정동 축 (ADR-0071). 시군구를 주면 시도는 그 앞 2자리라 따로 걸 필요가 없다.
                    query.sidoCode?.let { sido ->
                        b.filter { f -> f.term { it.field("ldongRegnCd").value(FieldValue.of(sido)) } }
                    }
                    query.sigunguCode?.let { sigungu ->
                        b.filter { f -> f.term { it.field("ldongSignguCd").value(FieldValue.of(sigungu)) } }
                    }
                    query.category?.let { category ->
                        b.filter { f -> f.term { it.field("category").value(FieldValue.of(category)) } }
                    }
                    query.geo?.let { geo ->
                        b.filter { f ->
                            f.geoDistance { g ->
                                g.field("location")
                                    .distance("${geo.radiusKm}km")
                                    .location { loc -> loc.latlon { ll -> ll.lat(geo.latitude).lon(geo.longitude) } }
                            }
                        }
                    }
                b
            }
        }
        val builder = SearchRequest.Builder()
            .index(INDEX)
            .from(pageable.offset.toInt())
            .size(pageable.pageSize)
            .query(withCategoryWeights(matched))

        val geo = query.geo
        if (geo != null && geo.sortByDistance) {
            builder.sort { s ->
                s.geoDistance { g ->
                    g.field("location")
                        .location { loc -> loc.latlon { ll -> ll.lat(geo.latitude).lon(geo.longitude) } }
                        .order(SortOrder.Asc)
                }
            }
        } else {
            // 결정적 tiebreaker (ADR-0050 Phase 1) — 동점시 페이지네이션 flicker 방지
            builder.sort { s -> s.score { it.order(SortOrder.Desc) } }
                .sort { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
        }

        return builder.build()
    }

    /**
     * 관광 분류를 올리고 상점·식당을 내린다 (ADR-0065 P2).
     *
     * `scoreMode = First` 인 이유: 분류는 문서당 하나뿐이라 두 함수가 함께 걸릴 일이 없고,
     * Multiply 로 두면 나중에 함수를 늘렸을 때 가중치가 곱해져 의도보다 크게 움직인다.
     * `boostMode = Multiply` 라 키워드 적합도의 상대 순서는 분류 안에서 그대로 유지된다.
     *
     * 키워드 없는 기본 목록에도 걸린다. 지금까지 관광지가 먼저 보인 건 적재 순서 덕이었고
     * 의도된 설계가 아니었다 — 음식·쇼핑을 먼저 재적재하면 첫 화면이 뒤집혔다.
     */
    private fun withCategoryWeights(matched: Query): Query {
        if (!ranking.enabled) return matched
        return Query.of { q ->
            q.functionScore { fs ->
                fs.query(matched)
                categoryFunction(fs, ranking.sightCategories, ranking.sightWeight)
                categoryFunction(fs, ranking.commerceCategories, ranking.commerceWeight)
                fs.scoreMode(FunctionScoreMode.First)
                fs.boostMode(FunctionBoostMode.Multiply)
            }
        }
    }

    private fun categoryFunction(
        fs: org.opensearch.client.opensearch._types.query_dsl.FunctionScoreQuery.Builder,
        categories: List<String>,
        weight: Double,
    ) {
        if (categories.isEmpty()) return
        fs.functions { fn ->
            fn.filter { f ->
                f.terms { t ->
                    t.field("category").terms { tv ->
                        tv.value(categories.map { FieldValue.of(it) })
                    }
                }
            }.weight(weight.toFloat())
        }
    }

    private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }
}

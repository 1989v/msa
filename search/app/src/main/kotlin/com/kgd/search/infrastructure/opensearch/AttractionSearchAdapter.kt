package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.Jamo
import com.kgd.search.domain.attraction.model.SuggestHit
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.mapping.FieldType
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch._types.query_dsl.Operator
import org.opensearch.client.opensearch._types.query_dsl.HybridQuery
import org.opensearch.client.opensearch._types.query_dsl.KnnQuery
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
    private val hybrid: AttractionHybridProperties,
    private val queryVector: QueryVectorProperties,
) : AttractionSearchPort {

    companion object {
        const val INDEX = "attractions"
        const val REGIONS_INDEX = "regions"

        /** 자동완성에서 지역이 차지하는 상단 슬롯 수 — "서울" 같은 지역 질의 우선 노출 */
        private const val SUGGEST_REGION_SLOTS = 3

        /**
         * 키워드 매칭 대상 — ko(nori)/en(english) 서브필드 동시 커버 (문서 단위 lang 분리, ADR-0065).
         * titleLocal 은 표시명에서 분리된 다른 표기(영문 문서의 국문명) — "도산공원" 질의가
         * `Dosan Park` 영문 문서를 찾는 리콜 축이라 title 과 같은 무게를 준다.
         */
        private val KEYWORD_FIELDS = listOf(
            "title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en",
        )
        private const val EARTH_RADIUS_KM = 6371.0

        /**
         * 벡터 필드는 **응답에서만** 뺀다 (ADR-0090). 매핑 `_source.excludes` 로 빼면 인덱스가
         * 3.4배 커진다 — k-NN 플러그인이 벡터를 다른 형태로 다시 저장하기 때문이다(플랜 §8.4 실측).
         * 하이브리드가 꺼져 있어도 뺀다: 필드는 이미 `_source` 에 있고, 문서당 4KB 를 그냥 실어 보낼 이유가 없다.
         */
        private const val VECTOR_FIELD = "embedding"
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
                    titleLocal = doc.titleLocal,
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
                    query.categories.takeIf { it.isNotEmpty() }?.let { categories ->
                        b.filter { f ->
                            f.terms { t ->
                                t.field("category").terms { tv ->
                                    tv.value(categories.map { FieldValue.of(it) })
                                }
                            }
                        }
                    }
                    // 질의 이해가 유도한 원천 분류 축 (ADR-0090 개정). 코드는 토큰이 아니라 값이라 term 이다.
                    query.contentTypeId?.let { type ->
                        b.filter { f -> f.term { it.field("contentTypeId").value(FieldValue.of(type)) } }
                    }
                    query.lclsCode?.let { code ->
                        // 깊이는 코드와 짝으로만 들어온다(포트 계약). 없으면 어느 필드에 걸지 알 수 없어 거른다.
                        query.lclsDepth?.let { depth ->
                            b.filter { f -> f.term { it.field("lclsSystm$depth").value(FieldValue.of(code)) } }
                        }
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
        val keywordLeg = withCategoryWeights(matched)
        val embedding = query.embedding

        val builder = SearchRequest.Builder()
            .index(INDEX)
            .from(pageable.offset.toInt())
            .size(pageable.pageSize)
            // 벡터는 답을 고르는 데 쓰이고 화면에는 안 나간다 — 문서당 4KB 를 실어 보내지 않는다.
            .source { s -> s.filter { f -> f.excludes(VECTOR_FIELD) } }

        if (embedding == null) {
            builder.query(keywordLeg)
        } else if (query.keyword == null) {
            // 검색어가 없으면 키워드 레그는 matchAll 이다 — 그것을 융합하면 **임의 순서**가
            // 벡터 결과와 같은 무게로 섞인다. 순위를 정할 신호가 벡터뿐이니 벡터만 쓴다.
            builder.query(vectorLeg(embedding, matched))
        } else {
            builder.query(hybridQuery(keywordLeg, embedding, matched, pageable.offset.toInt() + pageable.pageSize))
                // 파이프라인이 두 레그의 점수를 융합한다. **이름이 없으면 OpenSearch 가 요청을 거부한다** —
                // 조용히 BM25 로 떨어지지 않는다는 뜻이라, 파이프라인 부재는 즉시 드러난다.
                .searchPipeline(hybrid.pipeline)
        }

        val geo = query.geo
        if (geo != null && geo.sortByDistance) {
            builder.sort { s ->
                s.geoDistance { g ->
                    g.field("location")
                        .location { loc -> loc.latlon { ll -> ll.lat(geo.latitude).lon(geo.longitude) } }
                        .order(SortOrder.Asc)
                }
            }
            addTiebreakers(builder)
        } else if (embedding == null || query.keyword == null) {
            // 벡터 단독은 융합 파이프라인을 쓰지 않으므로 정렬을 걸 수 있다 — 동점 순서를 잃지 않는다.
            builder.sort { s -> s.score { it.order(SortOrder.Desc) } }
            addTiebreakers(builder)
        }
        // 하이브리드는 **정렬을 전혀 걸지 않는다.** OpenSearch 가 거부한다:
        //   "_score sort criteria cannot be applied with any other criteria."
        // 즉 점수 정렬과 tiebreaker 를 함께 줄 수 없다. 기본 정렬이 점수 내림차순이라 빼도 순서는 같고,
        // 대신 **동점 시 순서 보장이 사라진다** — RRF 점수는 1/(60+rank) 의 합이라 동점이 실제로 생긴다.
        // 로컬 프로브가 잡았다(플랜 §8.5 케이스 3). 단위 검사는 요청 모양만 보므로 이걸 못 잡는다.

        return builder.build()
    }

    /**
     * 결정적 tiebreaker (ADR-0050 Phase 1) — 동점시 페이지네이션 flicker 방지.
     * keyword `id` 는 문자열 PK 라 사전순("1","10","100")이 된다 — 숫자 필드 `idSort` 로
     * 정렬한다. `unmappedType`: 재색인 전 옛 인덱스에는 필드가 없어 정렬이 깨지는 것을
     * 막고, 그동안은 keyword `id` 가 최종 순서를 결정적으로 유지한다.
     *
     * **하이브리드 질의에는 걸 수 없다** — 위 `buildRequest` 의 주석 참고.
     */
    private fun addTiebreakers(builder: SearchRequest.Builder) {
        builder.sort { s ->
            s.field { f -> f.field("idSort").order(SortOrder.Asc).unmappedType(FieldType.Long) }
        }
            .sort { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
    }

    /**
     * 두 레그를 얹는다 (ADR-0090 D4) — 키워드 레그는 **지금 것 그대로**, 벡터 레그는 같은 필터를 진 k-NN.
     *
     * 벡터 레그에 `embeddingModel` 필터를 거는 것이 **스탬프 전환 창의 안전장치**다. 재색인이 아직
     * 옛 스탬프 문서를 갖고 있으면 그 문서는 다른 벡터 공간이라 거리가 뜻을 잃는다 — 필터가
     * 그것들을 벡터 레그에서 빼고, 그 문서는 키워드 레그로만 올라온다.
     *
     * 필터를 두 레그에 **각각** 거는 이유: 하이브리드는 레그별로 후보를 뽑아 합치므로,
     * 한쪽에만 걸면 다른 쪽이 필터 밖 문서를 끌어 온다(지역 필터를 건 검색에 엉뚱한 지역이 섞인다).
     */
    /**
     * 필터드 HNSW 한 레그. **필터를 `knn` 안에** 두는 것이 중요하다 — 밖에 두면 전역 이웃 k 개를
     * 뽑은 뒤 거르므로, 지역·분류 필터가 좁을수록 살아남는 것이 급격히 줄어 레그가 사실상 꺼진다.
     */
    private fun vectorLeg(embedding: List<Float>, filters: Query): Query = Query.of { q ->
        q.knn(
            KnnQuery.Builder()
                .field(VECTOR_FIELD)
                .vector(embedding)
                .k(hybrid.k)
                .filter(
                    Query.of { f ->
                        f.bool { b ->
                            b.filter(filters)
                            b.filter { m -> m.term { it.field("embeddingModel").value(FieldValue.of(queryVector.modelRef)) } }
                        }
                    },
                )
                .build(),
        )
    }

    private fun hybridQuery(keywordLeg: Query, embedding: List<Float>, filters: Query, depth: Int): Query {
        val vectorLeg = vectorLeg(embedding, filters)
        return Query.of { q ->
            q.hybrid(
                HybridQuery.Builder()
                    .queries(keywordLeg, vectorLeg)
                    // 각 레그가 융합에 내놓는 결과 수. 기본값이 10 이라 그냥 두면 **2페이지부터 빈다** —
                    // 융합은 레그별 상위 N 만 보므로 이 값이 `from + size` 보다 작으면 뒷장이 잘린다.
                    .paginationDepth(maxOf(depth, hybrid.k))
                    .build(),
            )
        }
    }

    /**
     * 분류 가중치 × 완결성 신호 (ADR-0065 P2 + 브라우즈 정렬).
     *
     * 관광 분류를 올리고 상점·식당을 내리는 것에 더해, **키워드 없는 목록의 순서**를 여기서
     * 정한다 — matchAll 은 전 문서 동점이라 이 함수 곱이 곧 순서다. 분류(관광 우선) 안에서
     * 완결성(이미지·개요·전화, AttractionPopularity)이 높은 문서가 먼저 온다. ko/en 에 같은
     * 공식이 걸려 영문 목록도 보여줄 준비가 된 레코드부터 나온다 (이전에는 keyword id
     * 사전순 — 사실상 무작위였다).
     *
     * `scoreMode = Multiply`: 분류 함수 둘은 필터가 배타라 문서당 하나만 걸리고, 완결성
     * fvf 는 항상 걸린다 — 곱해서 (분류 가중치 × ln1p(완결성)) 가 된다. 이전의 First 는
     * 함수가 분류 둘뿐일 때의 선택이고, fvf 를 넣는 순간 First 는 뒤 함수를 무시한다.
     *
     * fvf 의 `ln1p`: 완결성 원값(1.0~3.7)을 그대로 곱하면 키워드 검색에서 BM25 차이를
     * 완결성이 뒤집는다. ln1p 로 눌러 극단 간 배율을 약 2.2배(ln2≈0.69 ~ ln4.7≈1.55)로
     * 묶는다 — 브라우즈(동점)에선 순서를 정하기에 충분하고, 키워드 모드에선 텍스트
     * 적합도가 지배적으로 남는다. `missing = 1.0` 은 재색인 전 옛 인덱스(필드 없음)에서도
     * 중립(상수 배)으로 동작하게 한다.
     */
    private fun withCategoryWeights(matched: Query): Query {
        if (!ranking.enabled) return matched
        return Query.of { q ->
            q.functionScore { fs ->
                fs.query(matched)
                categoryFunction(fs, ranking.sightCategories, ranking.sightWeight)
                categoryFunction(fs, ranking.commerceCategories, ranking.commerceWeight)
                fs.functions { fn ->
                    fn.fieldValueFactor { fvf ->
                        fvf.field("popularityScore")
                            .factor(1.0f)
                            .modifier(FieldValueFactorModifier.Ln1p)
                            .missing(1.0)
                    }
                }
                fs.scoreMode(FunctionScoreMode.Multiply)
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

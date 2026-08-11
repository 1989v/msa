package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOrder
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
) : AttractionSearchPort {

    companion object {
        const val INDEX = "attractions"

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

    private fun buildRequest(query: AttractionSearchPort.SearchQuery, pageable: Pageable): SearchRequest {
        val builder = SearchRequest.Builder()
            .index(INDEX)
            .from(pageable.offset.toInt())
            .size(pageable.pageSize)
            .query { q ->
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

    private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }
}

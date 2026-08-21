package com.kgd.search.infrastructure.client

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.time.LocalDateTime

@Component
class PlaceApiClient(
    @Qualifier("placeWebClient") private val webClient: WebClient
) {
    private val log = KotlinLogging.logger {}

    data class AttractionDto(
        val id: Long,
        val contentId: String,
        val lang: String,
        val title: String,
        /** place 가 title 에서 파생한 표시명/로컬명 — 마이그레이션 전 place 응답에는 없을 수 있다. */
        val titleDisplay: String? = null,
        val titleLocal: String? = null,
        val latitude: Double,
        val longitude: Double,
        val address: String? = null,
        val areaCode: String? = null,
        val sigunguCode: String? = null,
        val ldongRegnCd: String? = null,
        val ldongSignguCd: String? = null,
        val category: String? = null,
        val imageUrl: String? = null,
        val tel: String? = null,
        val overview: String? = null,
        val sourceModifiedAt: LocalDateTime? = null,
        val status: String,
    )

    data class AttractionPageResponse(
        val attractions: List<AttractionDto>,
        val totalElements: Long,
        val totalPages: Int
    )

    data class RegionDto(
        val id: Long,
        val level: String,
        val name: String,
        val nameKo: String? = null,
        val countryCode: String? = null,
        val latitude: Double? = null,
        val longitude: Double? = null,
        val population: Long? = null,
    )

    data class RegionPageResponse(
        val regions: List<RegionDto>,
        val totalElements: Long,
        val totalPages: Int
    )

    suspend fun fetchRegionPage(page: Int, size: Int = 200): RegionPageResponse {
        val response = webClient.get()
            .uri("/api/places/regions/page?page=$page&size=$size")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any>
            ?: throw IllegalStateException("No data field in place region API response")

        @Suppress("UNCHECKED_CAST")
        val regions = (data["regions"] as? List<Map<String, Any>> ?: emptyList()).map { r ->
            RegionDto(
                id = (r["id"] as Number).toLong(),
                level = r["level"] as String,
                name = r["name"] as String,
                nameKo = r["nameKo"] as? String,
                countryCode = r["countryCode"] as? String,
                latitude = (r["latitude"] as? Number)?.toDouble(),
                longitude = (r["longitude"] as? Number)?.toDouble(),
                population = (r["population"] as? Number)?.toLong(),
            )
        }
        return RegionPageResponse(
            regions = regions,
            totalElements = (data["totalElements"] as Number).toLong(),
            totalPages = (data["totalPages"] as Number).toInt()
        )
    }

    suspend fun fetchPage(page: Int, size: Int = 100): AttractionPageResponse {
        log.debug { "Fetching attractions: page=$page, size=$size" }

        val response = webClient.get()
            .uri("/api/places/attractions?page=$page&size=$size")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any>
            ?: throw IllegalStateException("No data field in place API response")

        @Suppress("UNCHECKED_CAST")
        val attractions = (data["attractions"] as? List<Map<String, Any>> ?: emptyList()).map { a ->
            AttractionDto(
                id = (a["id"] as Number).toLong(),
                contentId = a["contentId"] as String,
                lang = a["lang"] as String,
                title = a["title"] as String,
                titleDisplay = a["titleDisplay"] as? String,
                titleLocal = a["titleLocal"] as? String,
                latitude = (a["latitude"] as Number).toDouble(),
                longitude = (a["longitude"] as Number).toDouble(),
                address = a["address"] as? String,
                areaCode = a["areaCode"] as? String,
                sigunguCode = a["sigunguCode"] as? String,
                ldongRegnCd = a["ldongRegnCd"] as? String,
                ldongSignguCd = a["ldongSignguCd"] as? String,
                category = a["category"] as? String,
                imageUrl = a["imageUrl"] as? String,
                tel = a["tel"] as? String,
                overview = a["overview"] as? String,
                sourceModifiedAt = (a["sourceModifiedAt"] as? String)?.let { LocalDateTime.parse(it) },
                status = a["status"] as String,
            )
        }

        return AttractionPageResponse(
            attractions = attractions,
            totalElements = (data["totalElements"] as Number).toLong(),
            totalPages = (data["totalPages"] as Number).toInt()
        )
    }
}

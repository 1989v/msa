package com.kgd.search.infrastructure.client

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import com.kgd.search.domain.embedding.VectorCodec
import org.springframework.web.reactive.function.client.WebClient
import java.time.LocalDateTime

@Component
class PlaceApiClient(
    @Qualifier("placeWebClient") private val webClient: WebClient
) {
    private val log = KotlinLogging.logger {}

    /**
     * 응답 JSON 을 Map 으로 받아 손으로 꺼내 담는다 — **필드를 여기 추가하지 않으면 기본값 null 이 조용히 이긴다.**
     * 데이터 클래스에만 넣고 아래 매핑을 빼먹어 썸네일이 통째로 null 로 색인된 적이 있다 (2026-09-04).
     */
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
        /** 원천 분류체계 — place 가 이미 내보내고 있었는데 색인이 안 읽고 있었다. */
        val lclsSystm1: String? = null,
        val lclsSystm2: String? = null,
        val lclsSystm3: String? = null,
        val contentTypeId: String? = null,
        val imageUrl: String? = null,
        val thumbnailUrl: String? = null,
        val tel: String? = null,
        val overview: String? = null,
        /** 구글맵 딥링크용 place_id — V10 이전 place 응답에는 없을 수 있다. */
        val useTime: String? = null,
        val restDate: String? = null,
        val useFee: String? = null,
        val parking: String? = null,
        val parkingFee: String? = null,
        val infoCenter: String? = null,
        val introRaw: String? = null,
        val googlePlaceId: String? = null,
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

    /** `/internal/attractions/embeddings/lookup` 한 건. 벡터는 이미 float 리스트로 풀어 둔다. */
    data class EmbeddingDto(val attractionId: Long, val textHash: String, val vector: List<Float>)

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
                lclsSystm1 = a["lclsSystm1"] as? String,
                lclsSystm2 = a["lclsSystm2"] as? String,
                lclsSystm3 = a["lclsSystm3"] as? String,
                contentTypeId = a["contentTypeId"] as? String,
                imageUrl = a["imageUrl"] as? String,
                thumbnailUrl = a["thumbnailUrl"] as? String,
                tel = a["tel"] as? String,
                overview = a["overview"] as? String,
                useTime = a["useTime"] as? String,
                restDate = a["restDate"] as? String,
                useFee = a["useFee"] as? String,
                parking = a["parking"] as? String,
                parkingFee = a["parkingFee"] as? String,
                infoCenter = a["infoCenter"] as? String,
                introRaw = a["introRaw"] as? String,
                googlePlaceId = a["googlePlaceId"] as? String,
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

    /**
     * 관광지 벡터 조회 (ADR-0090). `/api` 가 아니라 `/internal` 이라 게이트웨이가 라우팅하지 않지만,
     * placeWebClient 는 place 서비스를 직접 가리키므로 클러스터 안에서는 닿는다.
     *
     * 한 번에 500건까지(서버 상한). 벡터가 없는 id 는 응답에 **오지 않는다** — 그 문서는 BM25 로만 찾힌다.
     */
    suspend fun lookupEmbeddings(modelRef: String, ids: List<Long>): Map<Long, EmbeddingDto> {
        if (ids.isEmpty()) return emptyMap()
        require(ids.size <= LOOKUP_MAX_BATCH) { "한 번에 ${LOOKUP_MAX_BATCH}건까지입니다: ${ids.size}" }

        val response = webClient.post()
            .uri("/internal/attractions/embeddings/lookup")
            .bodyValue(mapOf("modelRef" to modelRef, "ids" to ids))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitSingle()

        @Suppress("UNCHECKED_CAST")
        val data = response["data"] as? Map<String, Any>
            ?: throw IllegalStateException("No data field in place embedding lookup response")

        @Suppress("UNCHECKED_CAST")
        val items = data["items"] as? List<Map<String, Any>> ?: emptyList()
        return items.associate { item ->
            val id = (item["attractionId"] as Number).toLong()
            id to EmbeddingDto(
                attractionId = id,
                textHash = item["textHash"] as String,
                vector = decodeVector(item["vector"] as String),
            )
        }
    }

    companion object {
        /** 서버 `AttractionEmbeddingInternalController.MAX_BATCH` 와 같은 값. */
        const val LOOKUP_MAX_BATCH = 500

        /**
         * float32 little-endian 바이트의 base64 → float 리스트.
         * 규약은 [VectorCodec] 한 곳이다 — 색인(batch)과 질의(app)가 각자 사본을 가지면
         * 한쪽 엔디안만 바뀌어도 예외 없이 그럴듯한 쓰레기 벡터가 나온다.
         */
        fun decodeVector(base64: String): List<Float> = VectorCodec.decode(base64)
    }
}

package com.kgd.search.infrastructure.client

import tools.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import com.kgd.search.domain.embedding.VectorCodec
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime

@Component
class PlaceApiClient(
    @Qualifier("placeWebClient") private val webClient: WebClient,
    private val objectMapper: ObjectMapper,
    /**
     * 호출 하나가 응답 본문까지 끝나야 하는 시간. 없으면 place 가 응답을 안 주는 순간 잡이 기한까지 멈춰 있다
     * (2026-09-29 재색인이 14분 넘게 한 호출을 기다렸다). 넘기면 예외가 올라가 잡이 실패하고 별칭은 그대로다.
     */
    @Value("\${place.service.response-timeout:60s}") private val responseTimeout: Duration = Duration.ofSeconds(60),
) {
    private val log = KotlinLogging.logger {}

    private suspend fun <T : Any> Mono<T>.awaitWithinTimeout(): T = timeout(responseTimeout).awaitSingle()

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
        val petAcmpyType: String? = null,
        val setting: String? = null,
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
        val imagesRaw: String? = null,
        val infoRaw: String? = null,
        val googlePlaceId: String? = null,
        val sourceModifiedAt: LocalDateTime? = null,
        /** 행사 원천 시작일·종료일(유형 15·85) — place 컬럼 값 그대로. 유효 기간 정규화는 재색인이 한다. */
        val eventStartDate: LocalDate? = null,
        val eventEndDate: LocalDate? = null,
        /** 목록 행 원문(TourAPI 목록 오퍼레이션 행 JSON) — 지금은 색인에 싣지 않는다. */
        val listRaw: String? = null,
        val status: String,
    )

    /** [nextAfterId] 가 null 이면 마지막 페이지다. */
    data class AttractionPageResponse(
        val attractions: List<AttractionDto>,
        val nextAfterId: Long?,
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

    /** `/internal/attractions/similar/lookup` 한 건 — 순위 순 id 와 그 목록을 계산한 벡터의 스탬프. */
    data class SimilarDto(val modelRef: String, val ids: List<Long>)

    /** 관광지에 붙는 부가 정보 한 건 — 무장애(긍정 코드 · 상세 원문) · 웰니스 테마 코드 · 집중률 예측. 다 없을 수 있다. */
    data class ExtrasDto(
        val barrierFreeFlags: List<String>?,
        val barrierFreeDetailRaw: String?,
        val wellnessThemeCode: String?,
        val congestion: List<CongestionDayDto>? = null,
    )

    /** 집중률 하루 — [date] 는 place 가 준 `yyyy-MM-dd` 문자열 그대로, [rate] 는 원천 값. */
    data class CongestionDayDto(val date: String, val rate: Double)

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
            .awaitWithinTimeout()

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

    /**
     * id 가 [afterId] 보다 큰 관광지를 id 순으로 [size] 건 — 키셋 페이징. 첫 페이지는 0 을 넘긴다.
     * OFFSET 페이지(`page=`)는 뒤로 갈수록 느려져 590쪽이 18초 걸렸다. 키셋은 어느 위치든 첫 페이지 속도다.
     */
    suspend fun fetchPageAfter(afterId: Long, size: Int = 100): AttractionPageResponse {
        log.debug { "Fetching attractions: afterId=$afterId, size=$size" }

        val response = webClient.get()
            .uri("/api/places/attractions?afterId=$afterId&size=$size")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

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
                petAcmpyType = a["petAcmpyType"] as? String,
                setting = a["setting"] as? String,
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
                imagesRaw = a["imagesRaw"] as? String,
                infoRaw = a["infoRaw"] as? String,
                googlePlaceId = a["googlePlaceId"] as? String,
                sourceModifiedAt = (a["sourceModifiedAt"] as? String)?.let { LocalDateTime.parse(it) },
                eventStartDate = (a["eventStartDate"] as? String)?.let { LocalDate.parse(it) },
                eventEndDate = (a["eventEndDate"] as? String)?.let { LocalDate.parse(it) },
                listRaw = a["listRaw"] as? String,
                status = a["status"] as String,
            )
        }

        return AttractionPageResponse(
            attractions = attractions,
            nextAfterId = (data["nextAfterId"] as? Number)?.toLong(),
        )
    }

    /**
     * 관광지 벡터 조회 (ADR-0090). `/api` 가 아니라 `/internal` 이라 게이트웨이가 라우팅하지 않지만,
     * placeWebClient 는 place 서비스를 직접 가리키므로 클러스터 안에서는 닿는다.
     *
     * 한 번에 500건까지(서버 상한). 벡터가 없는 id 는 응답에 **오지 않는다** — 그 문서는 BM25 로만 찾힌다.
     */
    /**
     * 시도 코드 → 이름 (ADR-0095). 285행짜리 표라 **한 번 받아 메모리에 든다** —
     * 화면이 이걸 받아 코드 하나를 이름으로 바꾸던 호출을 없애려는 것이므로,
     * 색인 쪽에서 관광지마다 부르면 본말전도다.
     */
    suspend fun fetchSidoNames(lang: String): Map<String, String> {
        val response = webClient.get()
            .uri("/api/places/administrative-regions?level=SIDO&lang=$lang")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = (response["data"] as? Map<String, Any>)?.get("regions") as? List<Map<String, Any>>
            ?: return emptyMap()
        return items.mapNotNull { r ->
            val code = r["code"] as? String ?: return@mapNotNull null
            val name = (r["name"] as? String)?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            // place 는 lang 과 무관하게 국문 name 을 준다. 영문 문서는 시군구와 같은 규칙(`nameEn || name`)으로
            // 고른다 — 국문을 그대로 쓰면 영문 상세에 시도 이름만 한글로 남는다.
            val localized = if (lang == "en") (r["nameEn"] as? String)?.takeIf { it.isNotBlank() } ?: name else name
            code to localized
        }.toMap()
    }

    /**
     * 시군구 5자리 코드(시도 2 + 시군구 3) → 이름, 언어별. 250행 남짓이라 회차당 한 번 받는다.
     * `lang` 을 넘기지 않는다 — 넘기면 place 가 관광지 건수를 group by 로 세는데 여기선 이름만 쓴다.
     * 영문은 화면(`nameEn || name`)과 같은 규칙으로 영문명이 없을 때 국문명을 쓴다.
     */
    suspend fun fetchSigunguNames(): Map<String, Map<String, String>> {
        val response = webClient.get()
            .uri("/api/places/administrative-regions?level=SIGUNGU")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = (response["data"] as? Map<String, Any>)?.get("regions") as? List<Map<String, Any>>
            ?: return emptyMap()
        val ko = HashMap<String, String>()
        val en = HashMap<String, String>()
        items.forEach { r ->
            val code = r["code"] as? String ?: return@forEach
            val name = (r["name"] as? String)?.takeIf { it.isNotBlank() } ?: return@forEach
            ko[code] = name
            en[code] = (r["nameEn"] as? String)?.takeIf { it.isNotBlank() } ?: name
        }
        return mapOf("ko" to ko, "en" to en)
    }

    /**
     * 원천 분류체계 소분류(lclsSystm3) 코드 → 이름. place 가 TourAPI 코드표를 언어별로 들고 있다.
     * 문서마다 부르지 않고 회차당 언어별로 한 번 받는다.
     */
    suspend fun fetchCategoryNames(lang: String): Map<String, String> {
        val response = webClient.get()
            .uri("/api/places/attractions/category-codes?lang=$lang")
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = response["data"] as? List<Map<String, Any>> ?: return emptyMap()
        return items.mapNotNull { c ->
            if ((c["depth"] as? Number)?.toInt() != 3) return@mapNotNull null
            val code = c["code"] as? String ?: return@mapNotNull null
            val name = (c["name"] as? String)?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            code to name
        }.toMap()
    }

    /**
     * 관광지 외부 링크 벌크 조회 (ADR-0095). **큐를 건드리지 않는 경로**를 쓴다 —
     * 화면용 `/links` 는 조회할 때 수집 큐에 올리므로 재색인이 부르면 큐가 가득 찬다.
     */
    suspend fun lookupLinks(ids: List<Long>): Map<Long, String> {
        if (ids.isEmpty()) return emptyMap()
        val response = webClient.post()
            .uri("/internal/attractions/links/lookup")
            .bodyValue(mapOf("ids" to ids))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = (response["data"] as? Map<String, Any>)?.get("items") as? List<Map<String, Any>>
            ?: return emptyMap()
        return items.mapNotNull { item ->
            val id = (item["attractionId"] as? Number)?.toLong() ?: return@mapNotNull null
            // 원문을 그대로 싣는다 — 화면이 쓰는 모양을 색인이 고쳐 쓰면 둘이 갈린다.
            id to objectMapper.writeValueAsString(
                mapOf("collected" to item["collected"], "deepLinks" to item["deepLinks"]),
            )
        }.toMap()
    }

    suspend fun lookupEmbeddings(modelRef: String, ids: List<Long>): Map<Long, EmbeddingDto> {
        if (ids.isEmpty()) return emptyMap()
        require(ids.size <= LOOKUP_MAX_BATCH) { "한 번에 ${LOOKUP_MAX_BATCH}건까지입니다: ${ids.size}" }

        val response = webClient.post()
            .uri("/internal/attractions/embeddings/lookup")
            .bodyValue(mapOf("modelRef" to modelRef, "ids" to ids))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

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

    /**
     * 비슷한 곳(다른 시도) 목록 조회. 목록이 없는 id 는 응답에 오지 않는다. 한 번에 [LOOKUP_MAX_BATCH] 건까지.
     * 점수는 싣지 않는다 — 상세는 순서만 쓴다.
     */
    suspend fun lookupSimilar(modelRef: String, ids: List<Long>): Map<Long, SimilarDto> {
        if (ids.isEmpty()) return emptyMap()
        require(ids.size <= LOOKUP_MAX_BATCH) { "한 번에 ${LOOKUP_MAX_BATCH}건까지입니다: ${ids.size}" }

        val response = webClient.post()
            .uri("/internal/attractions/similar/lookup")
            .bodyValue(mapOf("modelRef" to modelRef, "ids" to ids))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = (response["data"] as? Map<String, Any>)?.get("items") as? List<Map<String, Any>>
            ?: throw IllegalStateException("No data field in place similar lookup response")
        return items.associate { item ->
            @Suppress("UNCHECKED_CAST")
            val similar = item["similar"] as? List<Map<String, Any>> ?: emptyList()
            (item["attractionId"] as Number).toLong() to SimilarDto(
                modelRef = item["modelRef"] as String,
                ids = similar.map { (it["id"] as Number).toLong() },
            )
        }
    }

    /**
     * 부가 정보(무장애 · 웰니스 · 집중률) 묶음 조회 — 표마다 따로 부르지 않고 한 번에 받는다. 아무것도 없는 id 는 응답에 없다.
     * 무장애 상세는 원문 문자열 그대로 받는다 — 줄을 고르는 규칙은 도메인([com.kgd.search.domain.attraction.model.BarrierFreeInfo])이 갖는다.
     */
    suspend fun lookupExtras(ids: List<Long>): Map<Long, ExtrasDto> {
        if (ids.isEmpty()) return emptyMap()
        require(ids.size <= LOOKUP_MAX_BATCH) { "한 번에 ${LOOKUP_MAX_BATCH}건까지입니다: ${ids.size}" }

        val response = webClient.post()
            .uri("/internal/attractions/extras/lookup")
            .bodyValue(mapOf("ids" to ids))
            .retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any>>() {})
            .awaitWithinTimeout()

        @Suppress("UNCHECKED_CAST")
        val items = (response["data"] as? Map<String, Any>)?.get("items") as? List<Map<String, Any?>>
            ?: throw IllegalStateException("No data field in place extras lookup response")
        return items.associate { item ->
            @Suppress("UNCHECKED_CAST")
            val barrierFree = item["barrierFree"] as? Map<String, Any?>
            @Suppress("UNCHECKED_CAST")
            val wellness = item["wellness"] as? Map<String, Any?>
            @Suppress("UNCHECKED_CAST")
            val congestion = item["congestion"] as? Map<String, Any?>
            (item["attractionId"] as Number).toLong() to ExtrasDto(
                barrierFreeFlags = (barrierFree?.get("flags") as? List<*>)?.map { it.toString() },
                barrierFreeDetailRaw = barrierFree?.get("detailRaw") as? String,
                wellnessThemeCode = wellness?.get("themaCd") as? String,
                // 날짜·값이 빠진 날은 건너뛴다 — 0 으로 채우지 않는다
                congestion = (congestion?.get("days") as? List<*>)?.mapNotNull { day ->
                    val d = day as? Map<*, *> ?: return@mapNotNull null
                    val date = d["date"] as? String ?: return@mapNotNull null
                    val rate = (d["rate"] as? Number)?.toDouble() ?: return@mapNotNull null
                    CongestionDayDto(date, rate)
                },
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

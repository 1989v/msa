package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.Attraction
import org.springframework.cache.annotation.CacheEvict
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service

/**
 * 관광지 적재/조회 (ADR-0065). OpenSearch 색인은 여기서 하지 않는다 —
 * attractions 읽기 모델은 search-batch 가 일괄 재색인 (POI 동기 색인과 다른 선택).
 */
@Service
class AttractionService(
    private val attractionRepository: AttractionRepositoryPort,
) : UpsertAttractionUseCase, GetAttractionUseCase {

    /** 행정구역 응답의 관광 분류 건수가 이 적재로 바뀐다 — 지역 캐시를 비운다. */
    @CacheEvict(RegionCaches.ADMINISTRATIVE, allEntries = true)
    override fun executeBulk(commands: List<UpsertAttractionUseCase.Command>): UpsertAttractionUseCase.Result {
        val summary = attractionRepository.upsertAll(commands.map { it.toDomain() })
        return UpsertAttractionUseCase.Result(
            created = summary.created,
            updated = summary.updated,
            total = attractionRepository.count(),
        )
    }

    override fun findById(id: Long): GetAttractionUseCase.AttractionView =
        (attractionRepository.findById(id) ?: throw AttractionNotFoundException(id)).toView()

    override fun findPage(lang: String?, pageable: Pageable): Page<GetAttractionUseCase.AttractionView> =
        attractionRepository.findPage(lang, pageable).map { it.toView() }

    // 한 건 더 읽어 다음이 있는지 안다 — 마지막 페이지가 꼭 size 로 끝나도 빈 요청을 한 번 더 부르지 않게.
    override fun findAfter(lang: String?, afterId: Long, size: Int): GetAttractionUseCase.AttractionSlice {
        val rows = attractionRepository.findAfter(lang, afterId, size + 1)
        val items = rows.take(size).map { it.toView() }
        return GetAttractionUseCase.AttractionSlice(
            items = items,
            nextAfterId = if (rows.size > size) items.last().id else null,
        )
    }

    private fun UpsertAttractionUseCase.Command.toDomain(): Attraction = Attraction.create(
        contentId = contentId,
        lang = lang,
        source = source ?: Attraction.TOURAPI,
        title = title,
        latitude = latitude,
        longitude = longitude,
        address = address,
        areaCode = areaCode,
        sigunguCode = sigunguCode,
        ldongRegnCd = ldongRegnCd,
        ldongSignguCd = ldongSignguCd,
        category = category,
        cat1 = cat1,
        cat2 = cat2,
        cat3 = cat3,
        lclsSystm1 = lclsSystm1,
        lclsSystm2 = lclsSystm2,
        lclsSystm3 = lclsSystm3,
        contentTypeId = contentTypeId,
        copyrightDivCd = copyrightDivCd,
        thumbnailUrl = thumbnailUrl,
        mapLevel = mapLevel,
        zipcode = zipcode,
        sourceCreatedAt = sourceCreatedAt,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        introRaw = introRaw,
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introSyncedAt = introSyncedAt,
        petAcmpyType = petAcmpyType,
        petRaw = petRaw,
        petSyncedAt = petSyncedAt,
        imagesRaw = imagesRaw,
        infoRaw = infoRaw,
        extraSyncedAt = extraSyncedAt,
        eventStartDate = eventStartDate,
        eventEndDate = eventEndDate,
        listRaw = listRaw,
        googlePlaceId = googlePlaceId,
        sourceModifiedAt = sourceModifiedAt,
    )

    private fun Attraction.toView() = GetAttractionUseCase.AttractionView(
        id = requireNotNull(id) { "저장된 관광지에 ID가 없습니다" },
        contentId = contentId,
        lang = lang,
        source = source,
        title = title,
        titleDisplay = titleDisplay,
        titleLocal = titleLocal,
        address = address,
        areaCode = areaCode,
        sigunguCode = sigunguCode,
        ldongRegnCd = ldongRegnCd,
        ldongSignguCd = ldongSignguCd,
        category = category,
        cat1 = cat1,
        cat2 = cat2,
        cat3 = cat3,
        lclsSystm1 = lclsSystm1,
        lclsSystm2 = lclsSystm2,
        lclsSystm3 = lclsSystm3,
        contentTypeId = contentTypeId,
        copyrightDivCd = copyrightDivCd,
        thumbnailUrl = thumbnailUrl,
        mapLevel = mapLevel,
        zipcode = zipcode,
        sourceCreatedAt = sourceCreatedAt,
        latitude = latitude,
        longitude = longitude,
        imageUrl = imageUrl,
        tel = tel,
        overview = overview,
        introRaw = introRaw,
        useTime = useTime,
        restDate = restDate,
        useFee = useFee,
        parking = parking,
        parkingFee = parkingFee,
        infoCenter = infoCenter,
        introSyncedAt = introSyncedAt,
        petAcmpyType = petAcmpyType,
        petRaw = petRaw,
        petSyncedAt = petSyncedAt,
        setting = setting,
        imagesRaw = imagesRaw,
        infoRaw = infoRaw,
        extraSyncedAt = extraSyncedAt,
        eventStartDate = eventStartDate,
        eventEndDate = eventEndDate,
        listRaw = listRaw,
        googlePlaceId = googlePlaceId,
        sourceModifiedAt = sourceModifiedAt,
        status = status,
    )
}

package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.Attraction
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

    private fun UpsertAttractionUseCase.Command.toDomain(): Attraction = Attraction.create(
        contentId = contentId,
        lang = lang,
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
        googlePlaceId = googlePlaceId,
        sourceModifiedAt = sourceModifiedAt,
    )

    private fun Attraction.toView() = GetAttractionUseCase.AttractionView(
        id = requireNotNull(id) { "저장된 관광지에 ID가 없습니다" },
        contentId = contentId,
        lang = lang,
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
        googlePlaceId = googlePlaceId,
        sourceModifiedAt = sourceModifiedAt,
        status = status,
    )
}

package com.kgd.place.application.poi.service

import com.kgd.place.application.poi.port.PoiIndexPort
import com.kgd.place.application.poi.port.PoiRepositoryPort
import com.kgd.place.application.poi.port.PoiSearchPort
import com.kgd.place.application.poi.usecase.CreatePoiUseCase
import com.kgd.place.application.poi.usecase.NearbyPoiUseCase
import com.kgd.place.domain.poi.model.GeoMath
import com.kgd.place.domain.poi.model.Poi
import org.springframework.stereotype.Service

/**
 * POI 적재/근처검색. 적재는 MySQL(SSOT) 저장 후 OpenSearch 색인.
 * 색인은 외부 IO 이므로 DB 트랜잭션 밖에서 수행한다(@Transactional 미부여, transactional-usage.md).
 */
@Service
class PoiService(
    private val poiRepository: PoiRepositoryPort,
    private val poiIndexPort: PoiIndexPort,
    private val poiSearchPort: PoiSearchPort,
) : CreatePoiUseCase, NearbyPoiUseCase {

    override fun execute(command: CreatePoiUseCase.Command): CreatePoiUseCase.Result {
        val saved = poiRepository.save(command.toDomain())
        poiIndexPort.index(saved.toDocument())
        return saved.toResult()
    }

    override fun executeBulk(commands: List<CreatePoiUseCase.Command>): List<CreatePoiUseCase.Result> {
        val saved = poiRepository.saveAll(commands.map { it.toDomain() })
        poiIndexPort.bulkIndex(saved.map { it.toDocument() })
        return saved.map { it.toResult() }
    }

    override fun nearby(query: NearbyPoiUseCase.Query): List<NearbyPoiUseCase.Result> =
        poiSearchPort.nearby(
            PoiSearchPort.NearbyQuery(
                latitude = query.latitude,
                longitude = query.longitude,
                radiusKm = query.radiusKm,
                category = query.category,
                keyword = query.keyword,
                size = query.size,
            )
        ).map { doc ->
            NearbyPoiUseCase.Result(
                id = doc.id,
                name = doc.name,
                categoryMajor = doc.categoryMajor,
                categoryMid = doc.categoryMid,
                address = doc.address,
                latitude = doc.latitude,
                longitude = doc.longitude,
                distanceKm = GeoMath.distanceKm(query.latitude, query.longitude, doc.latitude, doc.longitude),
            )
        }

    private fun CreatePoiUseCase.Command.toDomain(): Poi = Poi.create(
        source = source,
        sourceKey = sourceKey,
        name = name,
        latitude = latitude,
        longitude = longitude,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        categorySub = categorySub,
        regionId = regionId,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
    )

    private fun Poi.toResult() = CreatePoiUseCase.Result(
        id = requireNotNull(id) { "저장된 POI 에 ID가 없습니다" },
        name = name,
        categoryMajor = categoryMajor,
        latitude = latitude,
        longitude = longitude,
    )
}

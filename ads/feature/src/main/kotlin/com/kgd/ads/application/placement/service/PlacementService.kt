package com.kgd.ads.application.placement.service

import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.category.port.CategoryPort
import com.kgd.ads.application.placement.dto.PlacementView
import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.application.placement.port.PlacementPort
import com.kgd.ads.application.placement.usecase.GetAdCatalogUseCase
import com.kgd.ads.application.placement.usecase.ManagePlacementUseCase
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDate
import java.time.LocalDateTime

@Service
class PlacementService(
    private val placementPort: PlacementPort,
    private val categoryPort: CategoryPort,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : GetAdCatalogUseCase, ManagePlacementUseCase {

    override fun execute(): GetAdCatalogUseCase.Catalog {
        val today = LocalDate.now(clock).atStartOfDay()
        val requests = placementPort.sumRequests(today.minusDays(CATALOG_DAYS), today)
        val placements = placementPort.findAll()
            .filter { it.active && it.paidAllowed }
            .sortedBy { it.key }
            .map {
                GetAdCatalogUseCase.CatalogPlacement(
                    key = it.key,
                    host = it.host,
                    format = it.format,
                    aspectRatios = it.aspectRatios.map { r -> r.value }.sorted(),
                    floorMicros = it.floorMicros,
                    description = it.description,
                    averageDailyRequests = (requests[it.key] ?: 0) / CATALOG_DAYS,
                )
            }
        val categories = categoryPort.categories().map { GetAdCatalogUseCase.CatalogCategory(it.code, it.label) }
        return GetAdCatalogUseCase.Catalog(placements, categories)
    }

    override fun list(): List<PlacementView> = placementPort.findAll().sortedBy { it.key }.map(PlacementView::from)

    override fun unregistered(): List<UnregisteredPlacementView> = placementPort.findUnregistered()

    @Transactional("adsTransactionManager")
    override fun create(command: ManagePlacementUseCase.Create): PlacementView {
        val now = LocalDateTime.now(clock)
        val placement = AdPlacement.of(
            key = command.key,
            host = command.host,
            format = command.format,
            aspectRatios = command.aspectRatios.map(AspectRatio::of).toSet(),
            floorMicros = command.floorMicros,
            active = command.active,
            paidAllowed = command.paidAllowed,
            description = command.description.trim(),
        )
        if (!placementPort.create(placement, now)) throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 등록된 지면입니다: ${command.key}")
        auditPort.record(AdminAction(command.actorMemberId, "PLACEMENT_CREATE", TARGET, placement.key, summary(placement), now))
        return PlacementView.from(placement)
    }

    @Transactional("adsTransactionManager")
    override fun update(command: ManagePlacementUseCase.Update): PlacementView {
        val now = LocalDateTime.now(clock)
        val placement = placementPort.findByKey(command.key) ?: throw BusinessException(ErrorCode.NOT_FOUND, "등록되지 않은 지면입니다")
        command.floorMicros?.let(placement::changeFloor)
        command.active?.let(placement::changeActive)
        command.paidAllowed?.let(placement::changePaidAllowed)
        command.description?.let { placement.changeDescription(it.trim()) }
        placementPort.update(placement, now)
        auditPort.record(AdminAction(command.actorMemberId, "PLACEMENT_UPDATE", TARGET, placement.key, summary(placement), now))
        return PlacementView.from(placement)
    }

    private fun summary(p: AdPlacement) = "floor=${p.floorMicros} active=${p.active} paidAllowed=${p.paidAllowed}"

    private companion object {
        const val TARGET = "PLACEMENT"
        const val CATALOG_DAYS = 7L
    }
}

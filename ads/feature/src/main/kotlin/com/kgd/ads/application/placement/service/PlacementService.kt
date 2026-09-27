package com.kgd.ads.application.placement.service

import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.category.port.CategoryPort
import com.kgd.ads.application.placement.dto.FormatSpecView
import com.kgd.ads.application.placement.dto.PlacementView
import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.application.placement.port.PlacementPort
import com.kgd.ads.application.placement.usecase.GetAdCatalogUseCase
import com.kgd.ads.application.placement.usecase.ManagePlacementUseCase
import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.creative.policy.CreativeImageFormat
import com.kgd.ads.domain.creative.policy.CreativeImageRules
import com.kgd.ads.domain.placement.model.AdPlacement
import com.kgd.ads.domain.placement.model.AspectRatio
import com.kgd.ads.domain.placement.model.FormatSpec
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
                val representative = FormatSpecView.from(it.representative())
                GetAdCatalogUseCase.CatalogPlacement(
                    key = it.key,
                    host = it.host,
                    formats = it.formats.map(FormatSpecView::from),
                    description = it.description,
                    averageDailyRequests = (requests[it.key] ?: 0) / CATALOG_DAYS,
                    format = representative.format,
                    aspectRatios = representative.aspectRatios,
                    floorMicros = representative.floorMicros,
                )
            }
        val categories = categoryPort.categories().map { GetAdCatalogUseCase.CatalogCategory(it.code, it.label) }
        return GetAdCatalogUseCase.Catalog(placements, categories, Campaign.HOURLY_CAP_PERCENT, UPLOAD_RULES)
    }

    override fun list(): List<PlacementView> = placementPort.findAll().sortedBy { it.key }.map(PlacementView::from)

    override fun unregistered(): List<UnregisteredPlacementView> = placementPort.findUnregistered()

    @Transactional("adsTransactionManager")
    override fun create(command: ManagePlacementUseCase.Create): PlacementView {
        val now = LocalDateTime.now(clock)
        val placement = AdPlacement.of(
            key = command.key,
            host = command.host,
            formats = command.formats.map(::spec),
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
        val placement = find(command.key)
        command.floorMicros?.let { placement.changeFloor(placement.representative().format, it) }
        command.active?.let(placement::changeActive)
        command.paidAllowed?.let(placement::changePaidAllowed)
        command.description?.let { placement.changeDescription(it.trim()) }
        return save(placement, command.actorMemberId, "PLACEMENT_UPDATE")
    }

    @Transactional("adsTransactionManager")
    override fun addFormat(command: ManagePlacementUseCase.AddFormat): PlacementView {
        val placement = find(command.key)
        placement.addFormat(spec(command.spec))
        return save(placement, command.actorMemberId, "PLACEMENT_FORMAT_ADD")
    }

    @Transactional("adsTransactionManager")
    override fun changeFormatFloor(command: ManagePlacementUseCase.ChangeFormatFloor): PlacementView {
        val placement = find(command.key)
        placement.changeFloor(command.format, command.floorMicros)
        return save(placement, command.actorMemberId, "PLACEMENT_FORMAT_UPDATE")
    }

    @Transactional("adsTransactionManager")
    override fun removeFormat(command: ManagePlacementUseCase.RemoveFormat): PlacementView {
        val placement = find(command.key)
        placement.removeFormat(command.format)
        return save(placement, command.actorMemberId, "PLACEMENT_FORMAT_REMOVE")
    }

    private fun find(key: String): AdPlacement =
        placementPort.findByKey(key) ?: throw BusinessException(ErrorCode.NOT_FOUND, "등록되지 않은 지면입니다")

    private fun save(placement: AdPlacement, actorMemberId: Long, action: String): PlacementView {
        val now = LocalDateTime.now(clock)
        placementPort.update(placement, now)
        auditPort.record(AdminAction(actorMemberId, action, TARGET, placement.key, summary(placement), now))
        return PlacementView.from(placement)
    }

    private fun spec(input: ManagePlacementUseCase.FormatSpecInput) =
        FormatSpec(input.format, input.aspectRatios.map(AspectRatio::of).toSet(), input.floorMicros)

    /** 형태별 최저가를 모두 적는다 — 한 형태만 바뀌어도 나머지 값이 그 시점에 무엇이었는지 남는다. */
    private fun summary(p: AdPlacement) =
        "formats=${p.formats.joinToString(",") { "${it.format}:${it.floorMicros}" }} active=${p.active} paidAllowed=${p.paidAllowed}"

    private companion object {
        const val TARGET = "PLACEMENT"
        const val CATALOG_DAYS = 7L
        val UPLOAD_RULES = GetAdCatalogUseCase.UploadRules(
            fileTypes = CreativeImageFormat.entries.map { it.contentType },
            maxBytes = CreativeImageRules.MAX_BYTES,
            maxDimension = CreativeImageRules.MAX_DIMENSION,
            aspectTolerance = AspectRatio.TOLERANCE,
        )
    }
}

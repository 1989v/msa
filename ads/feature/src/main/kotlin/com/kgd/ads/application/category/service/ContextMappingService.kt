package com.kgd.ads.application.category.service

import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.application.category.dto.ContextMappingView
import com.kgd.ads.application.category.dto.HostCategoryView
import com.kgd.ads.application.category.port.CategoryPort
import com.kgd.ads.application.category.usecase.ManageContextMappingUseCase
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDateTime

@Service
class ContextMappingService(
    private val categoryPort: CategoryPort,
    private val auditPort: AdminAuditPort,
    @Qualifier("adsClock") private val clock: Clock,
) : ManageContextMappingUseCase {

    override fun mappings(): List<ContextMappingView> = categoryPort.mappings()

    override fun hostCategories(): List<HostCategoryView> = categoryPort.hostCategories()

    @Transactional("adsTransactionManager")
    override fun putMapping(command: ManageContextMappingUseCase.PutMapping): ContextMappingView {
        if (!CONTEXT_KEY.matches(command.contextKey)) invalid("문맥 키는 `종류:값` 형식 ${MAX_KEY_LENGTH}자 이하여야 합니다")
        requireCategory(command.categoryCode)
        val now = LocalDateTime.now(clock)
        categoryPort.saveMapping(command.contextKey, command.categoryCode, command.actorMemberId, now)
        auditPort.record(AdminAction(command.actorMemberId, "CONTEXT_MAPPING_PUT", "CONTEXT_MAPPING", command.contextKey, command.categoryCode, now))
        return ContextMappingView(command.contextKey, command.categoryCode, command.actorMemberId, now)
    }

    @Transactional("adsTransactionManager")
    override fun deleteMapping(command: ManageContextMappingUseCase.DeleteMapping) {
        if (!categoryPort.deleteMapping(command.contextKey)) throw BusinessException(ErrorCode.NOT_FOUND, "매핑이 없습니다")
        auditPort.record(
            AdminAction(command.actorMemberId, "CONTEXT_MAPPING_DELETE", "CONTEXT_MAPPING", command.contextKey, null, LocalDateTime.now(clock)),
        )
    }

    @Transactional("adsTransactionManager")
    override fun putHostCategory(command: ManageContextMappingUseCase.PutHostCategory): HostCategoryView {
        if (command.host.isBlank() || command.host.length > MAX_HOST_LENGTH) invalid("호스트는 1~${MAX_HOST_LENGTH}자여야 합니다")
        requireCategory(command.categoryCode)
        val now = LocalDateTime.now(clock)
        categoryPort.saveHostCategory(command.host, command.categoryCode, command.actorMemberId, now)
        auditPort.record(AdminAction(command.actorMemberId, "HOST_CATEGORY_PUT", "HOST_CATEGORY", command.host, command.categoryCode, now))
        return HostCategoryView(command.host, command.categoryCode, command.actorMemberId, now)
    }

    private fun requireCategory(code: String) {
        if (categoryPort.categories().none { it.code == code }) invalid("없는 카테고리입니다: $code")
    }

    private fun invalid(message: String): Nothing = throw BusinessException(ErrorCode.INVALID_INPUT, message)

    private companion object {
        const val MAX_KEY_LENGTH = 128
        const val MAX_HOST_LENGTH = 128
        val CONTEXT_KEY = Regex("^[a-z]+:\\S{1,120}$")
    }
}

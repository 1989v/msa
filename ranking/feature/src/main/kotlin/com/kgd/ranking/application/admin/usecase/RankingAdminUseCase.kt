package com.kgd.ranking.application.admin.usecase

import com.kgd.ranking.application.admin.dto.*
interface RankingAdminUseCase {
    fun read(path: String, params: Map<String, List<String>>): Any
    fun correct(key: String, request: CorrectionRequest, actor: Long): AdminOperation
    fun preview(request: PreviewRequest, actor: Long): GroupPreview
    fun apply(request: ApplyPreviewRequest, actor: Long): AdminOperation
    fun verify(brand: String, request: VerificationRequest, actor: Long): AdminOperation
    fun resolve(id: String, request: ResolveRequest, actor: Long): AdminOperation
    fun revert(id: String, request: RevertRequest, actor: Long): AdminOperation
    fun purgeAudits(): Int
}
interface CafeAdminIngestUseCase {
    fun sync(request: com.kgd.ranking.application.cafe.dto.CafeDrinkBulkRequest): com.kgd.ranking.application.cafe.dto.CafeDrinkBulkResult
}

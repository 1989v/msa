package com.kgd.ranking.application.admin.dto

import com.kgd.ranking.domain.cafe.model.CafeDrink
import java.time.Instant
import java.time.LocalDate

/** One revision covers the explicit correction field set of one natural key. */
data class FieldCorrection(val action: String, val value: String?, val baseline: String, val state: String = "ACTIVE", val reason: String? = null, val detectedAt: Instant? = null, val runId: String? = null, val evidenceUrl: String? = null, val evidenceCheckedAt: LocalDate? = null, val correctionReason: String? = null, val sourceSnapshot: CafeDrink? = null, val dependencies: Map<String, String?> = emptyMap())
data class DrinkCorrections(val drinkKey: String, val brandSlug: String, val revision: Long = 0, val fields: Map<String, FieldCorrection> = emptyMap(), val lastKnownSource: CafeDrink? = null)
data class BrandVerification(val brandSlug: String, val revision: Long = 0, val generation: Long = 0, val officialUrls: List<String> = emptyList(), val verifiedAt: LocalDate? = null, val verificationNote: String? = null)
data class FieldChange(val action: String, val value: String? = null)
data class CorrectionRequest(val idempotencyKey: String, val expectedRevision: Long, val sourceGeneration: Long, val fields: Map<String, FieldChange>, val reason: String, val evidenceUrl: String, val evidenceCheckedAt: LocalDate)
data class VerificationRequest(val idempotencyKey: String, val expectedRevision: Long, val officialUrls: List<String>, val verifiedAt: LocalDate, val verificationNote: String, val reason: String)
data class PreviewRequest(val keys: List<String>, val targetGroup: String, val reason: String, val evidenceUrl: String, val evidenceCheckedAt: LocalDate)
data class GroupPreview(val previewToken: String, val actorId: Long, val expiresAt: Instant, val request: PreviewRequest, val revisions: Map<String, Long>, val generations: Map<String, Long>, val changed: List<String>, val unchanged: List<String>, val blocked: List<String>, val targets: List<PreviewTarget> = emptyList())
data class PreviewTarget(val drinkKey: String, val brandSlug: String, val menuName: String?, val temperature: String?, val sizeLabel: String?, val caffeineStatus: String?, val sourceCategory: String?, val derivedGroup: String?, val before: String?, val after: String?, val outcome: String, val blockedReason: String? = null)
data class RevertTarget(val targetKey: String, val before: DrinkCorrections?, val restored: DrinkCorrections?, val beforeBrand: BrandVerification?, val restoredBrand: BrandVerification?, val reversible: Boolean, val blockedReason: String?)
data class RevertPreview(val operationId: String, val reversible: Boolean, val targets: List<RevertTarget>)
data class ApplyPreviewRequest(val previewToken: String, val idempotencyKey: String)
data class ResolveRequest(val idempotencyKey: String, val action: String, val value: String? = null, val expectedRevision: Long, val sourceGeneration: Long, val reason: String, val evidenceUrl: String, val evidenceCheckedAt: LocalDate)
data class RevertRequest(val idempotencyKey: String, val expectedRevisions: Map<String, Long>, val sourceGenerations: Map<String, Long>, val reason: String, val evidenceUrl: String, val evidenceCheckedAt: LocalDate)
data class AuditEvent(val id: String, val operationId: String, val actorId: String, val at: Instant, val targetKey: String, val brandSlug: String, val before: DrinkCorrections? = null, val after: DrinkCorrections? = null, val beforeBrand: BrandVerification? = null, val afterBrand: BrandVerification? = null, val sourceGeneration: Long, val reason: String, val evidenceUrl: String?, val evidenceCheckedAt: LocalDate?, val source: CafeDrink? = null, val beforeEffective: CafeDrink? = null, val afterEffective: CafeDrink? = null)
data class AdminOperation(val operationId: String, val fingerprint: String, val actorId: Long, val at: Instant, val changed: Int, val auditIds: List<String>, val revisions: Map<String, Long>, val generations: Map<String, Long>)
data class IngestRun(val runId: String, val parentRunId: String?, val brands: List<String>, val startedAt: Instant, val finishedAt: Instant? = null, val status: String = "RUNNING", val attemptedRows: Int, val committedRows: Int = 0, val removedRows: Int = 0, val overrideReapplied: Int = 0, val conflictFields: Int = 0, val orphanedKeys: Int = 0, val errorCode: String? = null, val stage: String? = null, val job: String = "CAFE_DRINK_BULK", val actor: String = "INTERNAL_CAFE_COLLECTOR", val generationBefore: Map<String, Long> = emptyMap(), val generationAfter: Map<String, Long> = emptyMap(), val checkedAtMin: LocalDate? = null, val checkedAtMax: LocalDate? = null, val elapsedMs: Long? = null, val errorSummary: String? = null)
data class AdminPage<T>(val items: List<T>, val total: Long, val page: Int, val size: Int, val summary: Map<String, Long>? = null)
class AdminValidation(val field: String, message: String) : IllegalArgumentException(message)
class AdminConflict(message: String) : RuntimeException(message)
class AdminNotFound(message: String) : RuntimeException(message)

package com.kgd.ranking.application.admin.service

import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.application.admin.port.RankingAdminPort
import com.kgd.ranking.application.admin.usecase.*
import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.domain.cafe.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.security.MessageDigest

@Service
class RankingAdminService(private val store: RankingAdminPort, private val sourceRepository: CafeDrinkRepositoryPort) : RankingAdminUseCase, CafeAdminIngestUseCase {
    private fun brand(slug: String) = store.brands().find { it.brandSlug == slug } ?: BrandVerification(slug)
    private fun correction(key: String) = store.corrections().find { it.drinkKey == key } ?: DrinkCorrections(key, CafeDrinkKey.fields(key)?.firstOrNull() ?: throw IllegalArgumentException("Invalid drink key"))
    private fun source(key: String) = store.sourceDrinks().find { CafeDrinkKey.of(it) == key } ?: throw AdminNotFound("Source row not found")
    private fun projected(row: CafeDrink, c: DrinkCorrections): CafeDrink {
        val active = c.fields.filterValues { it.state == "ACTIVE" }
        return CafeCorrectionProjection.apply(row, active.mapValues { it.value.action to it.value.value }).copy(
            officialSourceUrl = row.sourceUrl, officialCheckedAt = row.checkedAt,
            correctionEvidence = active.filterKeys { it != "adminNote" }.mapNotNull { (field, correction) ->
                val url = correction.evidenceUrl; val date = correction.evidenceCheckedAt
                if (url == null || date == null) null else field to CafeCorrectionEvidence(url, date, correction.correctionReason.orEmpty())
            }.toMap())
    }
    private fun evidence(reason: String, url: String, date: LocalDate) {
        if (reason.isBlank() || reason.length > 2000) throw AdminValidation("reason", "변경 사유를 입력하세요")
        try { CafeCorrectionProjection.https(url) } catch (_: IllegalArgumentException) { throw AdminValidation("evidenceUrl", "https 공식 근거 URL을 입력하세요") }
        if (date.isAfter(LocalDate.now(java.time.Clock.systemUTC()))) throw AdminValidation("evidenceCheckedAt", "미래 확인일은 허용하지 않습니다")
    }
    private fun check(c: DrinkCorrections, revision: Long, generation: Long) {
        if (c.revision != revision || brand(c.brandSlug).generation != generation) throw AdminConflict("Revision or source generation changed")
    }
    private fun fingerprint(vararg parts: Any) = MessageDigest.getInstance("SHA-256").digest(parts.joinToString("|").toByteArray()).joinToString("") { "%02x".format(it) }
    private fun operation(id: String, actor: Long, body: String, block: () -> List<AuditEvent>): AdminOperation {
        require(UUID.fromString(id).toString() == id) { "UUID idempotencyKey required" }
        val hash = fingerprint(body)
        store.operation(id)?.let {
            if (it.actorId != actor || it.fingerprint != hash) throw AdminConflict("Idempotency key body/actor mismatch")
            return it // Always before revision, generation and preview expiry checks.
        }
        val events = block()
        events.forEach(store::save)
        val result = AdminOperation(id, hash, actor, Instant.now(), events.size, events.map { it.id },
            events.associate { it.targetKey to (it.after?.revision ?: it.afterBrand!!.revision) }, events.associate { it.targetKey to it.sourceGeneration })
        store.save(result)
        return result
    }
    private fun change(key: String, changes: Map<String, FieldChange>, reason: String, url: String, date: LocalDate, op: String, actor: Long, resolving: Boolean = false): AuditEvent {
        val before = correction(key); val row = source(key)
        require(changes.isNotEmpty())
        val next = before.fields.toMutableMap()
        changes.forEach { (field, change) ->
            try { CafeCorrectionProjection.validate(row, field, change.action, change.value) }
            catch (e: IllegalArgumentException) { throw AdminValidation(field, e.message ?: "Invalid field") }
            if (!resolving && next[field]?.state?.let { it != "ACTIVE" } == true) throw AdminConflict("Resolve conflict explicitly")
            if (change.action == "RESET") next.remove(field)
            else next[field] = FieldCorrection(change.action, change.value, CafeCorrectionProjection.baseline(row, field), evidenceUrl = url, evidenceCheckedAt = date,
                correctionReason = reason, sourceSnapshot = row, dependencies = CafeCorrectionProjection.dependencies(row, field))
        }
        val after = before.copy(revision = before.revision + 1, fields = next, lastKnownSource = row)
        store.save(after)
        store.project(key, projected(row, after))
        return AuditEvent(UUID.randomUUID().toString(), op, actor.toString(), Instant.now(), key, row.brandSlug, before, after,
            sourceGeneration = brand(row.brandSlug).generation, reason = reason, evidenceUrl = url, evidenceCheckedAt = date,
            source = row, beforeEffective = projected(row, before), afterEffective = projected(row, after))
    }
    override fun correct(key: String, request: CorrectionRequest, actor: Long) = store.atomic(listOf(correction(key).brandSlug)) {
        operation(request.idempotencyKey, actor, "correct:$key:$request") {
            evidence(request.reason, request.evidenceUrl, request.evidenceCheckedAt)
            check(correction(key), request.expectedRevision, request.sourceGeneration)
            listOf(change(key, request.fields, request.reason, request.evidenceUrl, request.evidenceCheckedAt, request.idempotencyKey, actor))
        }
    }
    override fun preview(request: PreviewRequest, actor: Long) = store.atomic(request.keys.map { correction(it).brandSlug }) {
        evidence(request.reason, request.evidenceUrl, request.evidenceCheckedAt)
        require(request.keys.size in 1..200 && request.keys.distinct().size == request.keys.size && request.targetGroup in CafeCorrectionProjection.groups)
        val rows = store.sourceDrinks().associateBy(CafeDrinkKey::of)
        val records = request.keys.associateWith(::correction)
        val blocked = request.keys.filter { rows[it] == null || records[it]!!.fields.values.any { c -> c.state != "ACTIVE" } }
        val same = request.keys.filter { it !in blocked && projected(rows[it]!!, records[it]!!).drinkGroup == request.targetGroup }
        val targets = request.keys.map { key ->
            val row = rows[key]; val record = records.getValue(key)
            PreviewTarget(key, record.brandSlug, row?.menuName ?: record.lastKnownSource?.menuName, row?.temperature, row?.sizeLabel,
                row?.caffeineStatus?.name, row?.sourceCategory, row?.drinkGroup, row?.let { projected(it, record).drinkGroup }, request.targetGroup,
                if (key in blocked) "BLOCKED" else if (key in same) "UNCHANGED" else "CHANGE",
                if (row == null) "원천 행 없음" else if (key in blocked) "미해결 충돌 교정 있음" else null)
        }
        GroupPreview(UUID.randomUUID().toString(), actor, Instant.now().plusSeconds(300), request, records.mapValues { it.value.revision }, records.mapValues { brand(it.value.brandSlug).generation }, request.keys - blocked.toSet() - same.toSet(), same, blocked, targets).also(store::save)
    }
    override fun apply(request: ApplyPreviewRequest, actor: Long) = store.atomic {
        operation(request.idempotencyKey, actor, "apply:$request") {
            val p = store.preview(request.previewToken) ?: throw AdminConflict("Preview missing")
            if (p.actorId != actor || p.expiresAt < Instant.now() || p.blocked.isNotEmpty()) throw AdminConflict("Preview expired or blocked")
            p.request.keys.forEach { check(correction(it), p.revisions.getValue(it), p.generations.getValue(it)) }
            p.changed.map { change(it, mapOf("drinkGroup" to FieldChange("SET", p.request.targetGroup)), p.request.reason, p.request.evidenceUrl, p.request.evidenceCheckedAt, request.idempotencyKey, actor) }
        }
    }
    override fun verify(brand: String, request: VerificationRequest, actor: Long) = store.atomic(listOf(brand)) {
        operation(request.idempotencyKey, actor, "verify:$brand:$request") {
            if (request.officialUrls.isEmpty()) throw AdminValidation("officialUrls", "공식 URL이 필요합니다")
            try { request.officialUrls.forEach(CafeCorrectionProjection::https) } catch (_: IllegalArgumentException) { throw AdminValidation("officialUrls", "https 공식 URL을 입력하세요") }
            try { evidence(request.reason, request.officialUrls.first(), request.verifiedAt) }
            catch (error: AdminValidation) { throw AdminValidation(if (error.field == "evidenceCheckedAt") "verifiedAt" else if (error.field == "evidenceUrl") "officialUrls" else error.field, error.message.orEmpty()) }
            if (store.sourceDrinks().none { it.brandSlug == brand }) throw AdminNotFound("Brand not found")
            val before = brand(brand)
            if (before.revision != request.expectedRevision) throw AdminConflict("Brand revision changed")
            val after = before.copy(revision = before.revision + 1, officialUrls = request.officialUrls.distinct(), verifiedAt = request.verifiedAt, verificationNote = request.verificationNote)
            store.save(after)
            listOf(AuditEvent(UUID.randomUUID().toString(), request.idempotencyKey, actor.toString(), Instant.now(), "brand:$brand", brand, beforeBrand = before, afterBrand = after, sourceGeneration = before.generation, reason = request.reason, evidenceUrl = request.officialUrls.first(), evidenceCheckedAt = request.verifiedAt))
        }
    }
    override fun resolve(id: String, request: ResolveRequest, actor: Long) = store.atomic {
        operation(request.idempotencyKey, actor, "resolve:$id:$request") {
            evidence(request.reason, request.evidenceUrl, request.evidenceCheckedAt)
            val (key, field) = decodeConflict(id); val before = correction(key)
            check(before, request.expectedRevision, request.sourceGeneration)
            val fieldCorrection = before.fields[field] ?: throw AdminNotFound("Conflict missing")
            require(fieldCorrection.state != "ACTIVE")
            val change = when (request.action) {
                "ADOPT_SOURCE" -> FieldChange("RESET")
                "KEEP_CORRECTION" -> FieldChange(fieldCorrection.action, fieldCorrection.value)
                "REPLACE" -> FieldChange("SET", request.value)
                else -> throw IllegalArgumentException("Unknown resolution")
            }
            if (fieldCorrection.state == "ORPHANED") {
                require(change.action == "RESET")
                val after = before.copy(revision = before.revision + 1, fields = before.fields - field); store.save(after)
                listOf(AuditEvent(UUID.randomUUID().toString(), request.idempotencyKey, actor.toString(), Instant.now(), key, before.brandSlug, before, after, sourceGeneration = brand(before.brandSlug).generation, reason = request.reason, evidenceUrl = request.evidenceUrl, evidenceCheckedAt = request.evidenceCheckedAt))
            } else listOf(change(key, mapOf(field to change), request.reason, request.evidenceUrl, request.evidenceCheckedAt, request.idempotencyKey, actor, true))
        }
    }
    override fun revert(id: String, request: RevertRequest, actor: Long) = store.atomic {
        operation(request.idempotencyKey, actor, "revert:$id:$request") {
            evidence(request.reason, request.evidenceUrl, request.evidenceCheckedAt)
            val original = store.operation(id) ?: throw AdminNotFound("Operation missing")
            val events = store.audits().filter { it.id in original.auditIds }
            if (events.size != original.auditIds.size || events.isEmpty()) throw AdminConflict("Audit expired or operation has no changes")
            events.forEach { e ->
                if (request.expectedRevisions[e.targetKey] != original.revisions[e.targetKey] || request.sourceGenerations[e.targetKey] != original.generations[e.targetKey]) throw AdminConflict("Expected revision/generation required for every target")
                val revision = e.after?.let { correction(e.targetKey).revision } ?: brand(e.brandSlug).revision
                if (revision != original.revisions[e.targetKey] || brand(e.brandSlug).generation != e.sourceGeneration) throw AdminConflict("Later correction or source ingest prevents revert")
            }
            events.map { e ->
                val before = e.after?.let { correction(e.targetKey) }
                val after = e.before?.copy(revision = before!!.revision + 1)
                val beforeBrand = e.afterBrand?.let { brand(e.brandSlug) }
                val afterBrand = e.beforeBrand?.copy(revision = beforeBrand!!.revision + 1)
                after?.let { restored -> store.save(restored); val row = store.sourceDrinks().find { CafeDrinkKey.of(it) == e.targetKey }; store.project(e.targetKey, row?.let { projected(it, restored) }) }; afterBrand?.let(store::save)
                val row = store.sourceDrinks().find { CafeDrinkKey.of(it) == e.targetKey }
                AuditEvent(UUID.randomUUID().toString(), request.idempotencyKey, actor.toString(), Instant.now(), e.targetKey, e.brandSlug, before, after, beforeBrand, afterBrand, e.sourceGeneration, request.reason, request.evidenceUrl, request.evidenceCheckedAt, row, row?.let { projected(it, before!!) }, row?.let { projected(it, after!!) })
            }
        }
    }
    override fun purgeAudits() = store.atomic { store.purgeAudits(Instant.now().minusSeconds(AUDIT_RETENTION_DAYS * 86400)) }
    companion object { const val AUDIT_RETENTION_DAYS = 365L }
    private fun conflictId(key: String, field: String) = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("$key:$field".toByteArray())
    private fun decodeConflict(id: String): Pair<String, String> {
        val text = String(java.util.Base64.getUrlDecoder().decode(id)); return text.substringBeforeLast(':') to text.substringAfterLast(':')
    }

    @Transactional("rankingTransactionManager", readOnly = true)
    override fun read(path: String, params: Map<String, List<String>>): Any {
        fun param(name: String) = params[name]?.firstOrNull()
        fun <T> page(items: List<T>): AdminPage<T> {
            val p = param("page")?.toInt() ?: 0; val n = param("size")?.toInt() ?: 50
            require(p >= 0 && n in 1..200)
            return AdminPage(items.drop(p * n).take(n), items.size.toLong(), p, n)
        }
        val sources by lazy { store.sourceDrinks().associateBy(CafeDrinkKey::of) }
        val correctionRows by lazy { store.corrections().associateBy { it.drinkKey } }
        val brandRows by lazy { store.brands().associateBy { it.brandSlug } }
        fun correction(key: String) = correctionRows[key] ?: DrinkCorrections(key, CafeDrinkKey.fields(key)?.firstOrNull() ?: throw IllegalArgumentException("Invalid key"))
        fun brand(slug: String) = brandRows[slug] ?: BrandVerification(slug)
        fun detail(key: String): Map<String, Any?> {
            val row = sources[key]; val c = correction(key)
            if (row == null && c.revision == 0L) throw AdminNotFound("Drink missing")
            return mapOf("drinkKey" to key, "source" to row, "sourceSnapshot" to (c.lastKnownSource ?: c.fields.values.firstNotNullOfOrNull { it.sourceSnapshot }), "derived" to row?.let(CafeDrinkResponse::of), "override" to c.fields, "effective" to row?.let { CafeDrinkResponse.of(projected(it, c)) }, "adminNote" to row?.let { projected(it, c).adminNote }, "revision" to c.revision, "generation" to brand(c.brandSlug).generation)
        }
        return when {
            path == "cafe/drinks" -> {
                require(param("groupBasis") in setOf(null, "effective", "derived"))
                val sort = param("sort") ?: "name"
                require(sort in setOf("name", "checkedAt", "sugar", "caffeine", "kcal")) { "Unknown sort" }
                require(param("correctionState") in setOf(null, "NONE", "ACTIVE", "CONFLICT", "ORPHANED"))
                require(params["caffeineStatus"].orEmpty().all { status -> CaffeineStatus.entries.any { it.name == status } })
                val listKeys = if (param("correctionState") == "ORPHANED") correctionRows.values.filter { it.fields.values.any { f -> f.state == "ORPHANED" } }.map { it.drinkKey } else sources.keys.toList()
                val all = listKeys.map(::detail).filter { item ->
                    val key = item["drinkKey"] as String; val row = sources[key]; val c = correction(key)
                    if (row == null) return@filter (params["brand"].isNullOrEmpty() || c.brandSlug in params.getValue("brand"))
                    val effective = projected(row, c)
                    (param("q").isNullOrBlank() || row.menuName.contains(param("q")!!, true) || effective.displayName.orEmpty().contains(param("q")!!, true)) &&
                    (params["brand"].isNullOrEmpty() || row.brandSlug in params.getValue("brand")) &&
                    (param("group") == null || (if (param("groupBasis") == "derived") row.drinkGroup else effective.drinkGroup) == param("group")) &&
                    (param("temperature") == null || row.temperature == param("temperature")) &&
                    (params["caffeineStatus"].isNullOrEmpty() || row.caffeineStatus.name in params.getValue("caffeineStatus")) &&
                    (param("correctionState") == null || if (param("correctionState") == "NONE") c.fields.isEmpty() else c.fields.values.any { it.state == param("correctionState") }) &&
                    (param("checkedBefore") == null || effective.checkedAt < LocalDate.parse(param("checkedBefore")))
                }.sortedWith { a, b ->
                    val x = a["effective"] as CafeDrinkResponse?; val y = b["effective"] as CafeDrinkResponse?
                    val metric = when (sort) {
                        "sugar" -> compareValues(x?.sugarG, y?.sugarG)
                        "caffeine" -> compareValues(x?.caffeineMg, y?.caffeineMg)
                        "kcal" -> compareValues(x?.kcal, y?.kcal)
                        "checkedAt" -> compareValues(x?.checkedAt, y?.checkedAt)
                        else -> compareValues((a["source"] as CafeDrink?)?.brandSlug, (b["source"] as CafeDrink?)?.brandSlug)
                    }
                    val left = a["source"] as CafeDrink? ?: correction(a["drinkKey"].toString()).lastKnownSource
                    val right = b["source"] as CafeDrink? ?: correction(b["drinkKey"].toString()).lastKnownSource
                    metric.takeIf { it != 0 } ?: compareValuesBy(left, right, { it?.menuName }, { it?.temperature.orEmpty() }, { it?.sizeLabel.orEmpty() }, { it?.caffeineStatus?.name }).takeIf { it != 0 } ?: a["drinkKey"].toString().compareTo(b["drinkKey"].toString())
                }
                page(all).copy(summary = mapOf("sourceRows" to sources.size.toLong(), "correctedRows" to correctionRows.values.count { it.fields.isNotEmpty() }.toLong(), "conflictRows" to correctionRows.values.count { it.fields.values.any { f -> f.state == "CONFLICT" } }.toLong(), "conflictFields" to correctionRows.values.sumOf { it.fields.values.count { f -> f.state == "CONFLICT" } }.toLong(), "orphanedKeys" to correctionRows.values.count { it.fields.values.any { f -> f.state == "ORPHANED" } }.toLong()))
            }
            path.startsWith("cafe/drinks/") -> detail(path.removePrefix("cafe/drinks/"))
            path == "cafe/groups" -> mapOf("allowedGroups" to CafeCorrectionProjection.groups, "items" to CafeCorrectionProjection.groups.map { group ->
                mapOf("group" to group, "derivedCount" to sources.values.count { it.drinkGroup == group }, "effectiveCount" to sources.values.count { projected(it, correction(CafeDrinkKey.of(it))).drinkGroup == group }, "correctedCount" to sources.values.count { it.drinkGroup == group && correction(CafeDrinkKey.of(it)).fields.isNotEmpty() }, "conflictCount" to sources.values.count { it.drinkGroup == group && correction(CafeDrinkKey.of(it)).fields.values.any { f -> f.state != "ACTIVE" } })
            })
            path == "cafe/brands" -> page(sources.values.groupBy { it.brandSlug }.map { (slug, rows) -> mapOf("brandSlug" to slug, "brandName" to rows.first().brandName, "count" to rows.size, "sourceUrls" to rows.map { it.sourceUrl }.distinct(), "minCheckedAt" to rows.minOf { it.checkedAt }, "maxCheckedAt" to rows.maxOf { it.checkedAt }, "unknownVolumeCount" to rows.count { projected(it, correction(CafeDrinkKey.of(it))).cupVolumeMl == null }, "verification" to brand(slug), "rights" to "미확인 — 원천 대장 §9 확인") })
            path == "conflicts" -> page(store.corrections().flatMap { c -> c.fields.filterValues { it.state != "ACTIVE" }.map { (field, f) -> mapOf("id" to conflictId(c.drinkKey, field), "drinkKey" to c.drinkKey, "brandSlug" to c.brandSlug, "field" to field, "correction" to f, "state" to f.state, "sourceSnapshot" to f.sourceSnapshot, "currentSourceSnapshot" to sources[c.drinkKey], "baselineDependencies" to f.dependencies, "currentDependencies" to sources[c.drinkKey]?.let { CafeCorrectionProjection.dependencies(it, field) }, "currentSource" to sources[c.drinkKey]?.let { CafeCorrectionProjection.value(it, field) }, "currentEffective" to sources[c.drinkKey]?.let { CafeCorrectionProjection.value(projected(it, c), field) }, "revision" to c.revision, "generation" to brand(c.brandSlug).generation) } }.filter { (param("conflictId") == null || it["id"] == param("conflictId")) && (param("brand") == null || it["brandSlug"] == param("brand")) && (param("field") == null || it["field"] == param("field")) && (param("state") == null || it["state"] == param("state")) && (param("runId") == null || (it["correction"] as FieldCorrection).runId == param("runId")) }.sortedBy { (it["correction"] as FieldCorrection).detectedAt })
            path == "audit-events" -> page(store.audits().filter { (param("targetKey") == null || it.targetKey == param("targetKey")) && (param("actorId") == null || it.actorId == param("actorId")) && (param("operationId") == null || it.operationId == param("operationId")) && (param("from") == null || it.at >= Instant.parse(param("from"))) && (param("to") == null || it.at <= Instant.parse(param("to"))) }.sortedByDescending { it.at }.map { e ->
                val reversible = e.actorId != "SYSTEM" && store.operation(e.operationId)?.let { revertPreview(it).reversible } == true
                mapOf("event" to e, "revertible" to reversible, "revertBlockedReason" to if (reversible) null else "후속 교정 또는 원천 재적재됨")
            })
            path.startsWith("operations/") && path.endsWith("/revert-preview") -> revertPreview(store.operation(path.removePrefix("operations/").removeSuffix("/revert-preview")) ?: throw AdminNotFound("Operation missing"))
            path.startsWith("operations/") -> store.operation(path.removePrefix("operations/")) ?: throw AdminNotFound("Operation not found; retry same key/body")
            path == "ingest-runs" -> page(effectiveRuns().filter { (param("job") == null || param("job") == it.job) && (param("brand") == null || param("brand") in it.brands) && (param("status") == null || it.status == param("status")) && (param("from") == null || it.startedAt >= Instant.parse(param("from"))) && (param("to") == null || it.startedAt <= Instant.parse(param("to"))) }.sortedByDescending { it.startedAt })
            path.startsWith("ingest-runs/") -> { val id = path.removePrefix("ingest-runs/"); mapOf("run" to (effectiveRuns().find { it.runId == id } ?: throw AdminNotFound("Run missing")), "children" to effectiveRuns().filter { it.parentRunId == id }) }
            path == "gas/boards" -> page(store.gasBoards().filter { row -> (param("boardId") == null || row["id"].toString() == param("boardId")) && listOf("scope", "fuel", "status", "health").all { param(it) == null || row[it].toString() == param(it) } })
            path.startsWith("gas/boards/") && path.endsWith("/snapshots") -> page(store.gasSnapshots(path.removePrefix("gas/boards/").substringBefore('/').toLong()))
            path.startsWith("gas/snapshots/") -> store.gasSnapshot(path.removePrefix("gas/snapshots/").toLong()) ?: throw AdminNotFound("보관기간 경과 또는 자료 없음")
            else -> throw AdminNotFound("Unknown ranking admin resource")
        }
    }
    private fun revertPreview(operation: AdminOperation): RevertPreview {
        val events = store.audits().filter { it.id in operation.auditIds }.associateBy { it.id }
        val targets = operation.auditIds.map { id ->
            val event = events[id]
            if (event == null) RevertTarget(id, null, null, null, null, false, "감사 보관기간 경과")
            else {
                val current = event.after?.let { correction(event.targetKey) }
                val currentBrand = event.afterBrand?.let { brand(event.brandSlug) }
                val reason = when {
                    event.actorId == "SYSTEM" -> "SYSTEM 적재는 역실행하지 않음"
                    brand(event.brandSlug).generation != event.sourceGeneration -> "원천 재적재됨"
                    (current?.revision ?: currentBrand?.revision) != operation.revisions[event.targetKey] -> "이후 교정 있음"
                    else -> null
                }
                RevertTarget(event.targetKey, current, event.before, currentBrand, event.beforeBrand, reason == null, reason)
            }
        }
        return RevertPreview(operation.operationId, targets.isNotEmpty() && targets.all { it.reversible }, targets)
    }
    private fun effectiveRuns(): List<IngestRun> {
        val children = store.runs().map { if (it.status == "RUNNING" && it.startedAt < Instant.now().minusSeconds(900)) it.copy(status = "INTERRUPTED", elapsedMs = java.time.Duration.between(it.startedAt, Instant.now()).toMillis()) else it }
        val parents = children.mapNotNull { it.parentRunId }.distinct().map { id ->
            val rows = children.filter { it.parentRunId == id }; val statuses = rows.map { it.status }.toSet()
            val status = when {
                "RUNNING" in statuses -> "RUNNING"
                "SUCCESS" in statuses && statuses.size > 1 -> "PARTIAL"
                statuses == setOf("SUCCESS") -> "SUCCESS"
                "INTERRUPTED" in statuses -> "INTERRUPTED"
                else -> "FAILED"
            }
            val started = rows.minOf { it.startedAt }; val finished = if (status in setOf("RUNNING", "INTERRUPTED")) null else rows.mapNotNull { it.finishedAt }.maxOrNull()
            IngestRun(id, null, rows.flatMap { it.brands }.distinct(), started, finished, status,
                rows.sumOf { it.attemptedRows }, rows.sumOf { it.committedRows }, rows.sumOf { it.removedRows }, rows.sumOf { it.overrideReapplied }, rows.sumOf { it.conflictFields }, rows.sumOf { it.orphanedKeys },
                job = rows.first().job, actor = rows.first().actor, generationBefore = rows.flatMap { it.generationBefore.entries }.associate { it.key to it.value }, generationAfter = rows.flatMap { it.generationAfter.entries }.associate { it.key to it.value },
                checkedAtMin = rows.mapNotNull { it.checkedAtMin }.minOrNull(), checkedAtMax = rows.mapNotNull { it.checkedAtMax }.maxOrNull(), elapsedMs = java.time.Duration.between(started, finished ?: Instant.now()).toMillis(), errorSummary = rows.mapNotNull { it.errorSummary }.distinct().joinToString("; ").ifEmpty { null })
        }
        return children + parents
    }
    override fun sync(request: CafeDrinkBulkRequest): CafeDrinkBulkResult {
        var run = IngestRun(UUID.randomUUID().toString(), request.parentRunId, request.drinks.map { it.brandSlug }.distinct(), Instant.now(), attemptedRows = request.drinks.size)
        store.atomic {
            run = run.copy(generationBefore = run.brands.associateWith { brand(it).generation }, checkedAtMin = request.drinks.minOfOrNull { it.checkedAt }, checkedAtMax = request.drinks.maxOfOrNull { it.checkedAt })
            store.save(run); true
        }
        try {
            return store.atomic(run.brands) {
                run = run.copy(generationBefore = run.brands.associateWith { brand(it).generation })
                val rows = request.drinks.map { it.toDomain() }; rows.forEach(CafeCorrectionProjection::validateSource); val keys = rows.map(CafeDrinkKey::of)
                require(rows.all { it.brandSlug.isNotBlank() && it.menuName.isNotBlank() } && keys.distinct().size == keys.size) { "Invalid/duplicate natural key" }
                store.validateSourceKeys(rows)
                val old = store.sourceDrinks().filter { it.brandSlug in run.brands }
                val incoming = rows.associateBy(CafeDrinkKey::of)
                var reapplied = 0; var conflicts = 0; var orphans = 0
                run.brands.sorted().forEach { slug -> store.save(brand(slug).copy(generation = brand(slug).generation + 1)) }
                store.corrections().filter { it.brandSlug in run.brands }.forEach { before ->
                    val row = incoming[before.drinkKey]
                    if (row == null && before.fields.isNotEmpty()) orphans++
                    val fields = before.fields.mapValues { (field, f) ->
                        val reason = when {
                            row == null -> "KEY_DISAPPEARED"
                            f.state == "ORPHANED" -> "KEY_REAPPEARED"
                            f.state != "ACTIVE" -> f.reason ?: "REVIEW_PENDING"
                            (if (f.dependencies.isEmpty()) f.baseline != CafeCorrectionProjection.baseline(row, field) else f.dependencies != CafeCorrectionProjection.dependencies(row, field)) -> "SOURCE_CHANGED"
                            f.value != null && CafeCorrectionProjection.value(row, field)?.let { sourceValue -> if (field in CafeCorrectionProjection.numericFields) sourceValue.toBigDecimal().compareTo(f.value.toBigDecimal()) == 0 else sourceValue == f.value } == true -> "SOURCE_MATCHES_CORRECTION"
                            else -> null
                        }
                        if (reason == null) { reapplied++; f } else {
                            if (row != null) conflicts++
                            val state = if (row == null) "ORPHANED" else "CONFLICT"
                            if (f.state == state && f.state != "ACTIVE") f
                            else f.copy(state = state, reason = reason, detectedAt = Instant.now(), runId = run.runId)
                        }
                    }
                    val after = before.copy(revision = before.revision + if (fields != before.fields) 1 else 0, fields = fields, lastKnownSource = row ?: before.lastKnownSource ?: old.find { CafeDrinkKey.of(it) == before.drinkKey }); store.save(after)
                    val oldRow = old.find { CafeDrinkKey.of(it) == before.drinkKey }
                    store.save(AuditEvent(UUID.randomUUID().toString(), run.runId, "SYSTEM", Instant.now(), before.drinkKey, before.brandSlug, before, after, sourceGeneration = brand(before.brandSlug).generation, reason = "SOURCE_INGEST", evidenceUrl = row?.sourceUrl, evidenceCheckedAt = row?.checkedAt, source = row, beforeEffective = oldRow?.let { projected(it, before) }, afterEffective = row?.let { projected(it, after) }))
                }
                if (run.brands.isNotEmpty()) { sourceRepository.deleteByBrands(run.brands.toSet()); sourceRepository.saveAll(rows) }
                (old.map(CafeDrinkKey::of) + keys).distinct().forEach { key -> store.project(key, incoming[key]?.let { projected(it, correction(key)) }) }
                store.save(run.copy(finishedAt = Instant.now(), status = "SUCCESS", committedRows = rows.size, removedRows = old.size, overrideReapplied = reapplied, conflictFields = conflicts, orphanedKeys = orphans, generationAfter = run.brands.associateWith { brand(it).generation }, elapsedMs = java.time.Duration.between(run.startedAt, Instant.now()).toMillis()))
                CafeDrinkBulkResult(rows.size, run.brands.toSet())
            }
        } catch (e: RuntimeException) {
            store.atomic { store.save(run.copy(finishedAt = Instant.now(), status = "FAILED", errorCode = if (e is IllegalArgumentException) "INVALID_INPUT" else "PERSISTENCE_FAILURE", stage = if (e is IllegalArgumentException) "VALIDATE" else "COMMIT", generationAfter = run.generationBefore, elapsedMs = java.time.Duration.between(run.startedAt, Instant.now()).toMillis(), errorSummary = if (e is IllegalArgumentException) "원천 형식·정밀도·자연키 검증 실패" else "저장 실패: 직전 자료 유지")); true }
            throw e
        }
    }
}

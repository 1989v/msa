package com.kgd.ranking.infrastructure.persistence.adapter

import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.application.admin.port.RankingAdminPort
import com.kgd.ranking.infrastructure.persistence.entity.RankingAdminRecord
import com.kgd.ranking.infrastructure.persistence.repository.*
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.security.MessageDigest
import java.time.Instant

@Component
class RankingAdminAdapter(
    private val records: RankingAdminRecordRepository,
    private val drinks: CafeDrinkJpaRepository,
    private val effectiveDrinks: CafeEffectiveDrinkJpaRepository,
    private val boards: RankingBoardJpaRepository,
    private val snapshots: RankingSnapshotJpaRepository,
    private val entries: RankingEntryJpaRepository,
    @Qualifier("rankingTransactionManager") manager: PlatformTransactionManager,
    private val mapper: JsonMapper,
) : RankingAdminPort {
    @jakarta.persistence.PersistenceContext(unitName = "ranking")
    private lateinit var entityManager: EntityManager
    private val tx = TransactionTemplate(manager)
    private val cache = ThreadLocal<MutableMap<String, MutableMap<String, Any>>>()
    private val sourceCache = ThreadLocal<List<com.kgd.ranking.domain.cafe.model.CafeDrink>>()
    private fun id(kind: String, key: String) = kind + ":" + MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
    override fun <T : Any> atomic(brands: List<String>, action: () -> T): T = requireNotNull(tx.execute {
        // Stronger global lock also serializes a previously unseen operation UUID across instances.
        entityManager.find(RankingAdminRecord::class.java, "control", LockModeType.PESSIMISTIC_WRITE)
            ?: error("Ranking admin control row missing: apply V6 before enabling writes")
        brands.distinct().sorted().forEach { brand ->
            val key = id("LOCK", brand)
            if (!records.existsById(key)) records.saveAndFlush(RankingAdminRecord(key, "LOCK", "{}"))
            entityManager.find(RankingAdminRecord::class.java, key, LockModeType.PESSIMISTIC_WRITE)
        }
        cache.set(mutableMapOf()); sourceCache.remove()
        try { action() } finally { cache.remove(); sourceCache.remove() }
    })
    private fun <T : Any> all(kind: String, type: Class<T>): List<T> {
        val context = cache.get()
        if (context == null) return records.findByKind(kind).map { mapper.readValue(it.payload, type) }
        val rows = context.getOrPut(kind) { records.findByKind(kind).associate { it.id to mapper.readValue(it.payload, type) as Any }.toMutableMap() }
        return rows.values.map { type.cast(it) }
    }
    private fun <T : Any> one(kind: String, key: String, type: Class<T>) = records.findById(id(kind, key)).orElse(null)?.let { mapper.readValue(it.payload, type) }
    private fun put(kind: String, key: String, value: Any) {
        val recordId = id(kind, key); cache.get()?.get(kind)?.put(recordId, value)
        val payload = mapper.writeValueAsString(value)
        val row = records.findById(recordId).orElse(null)
        if (row == null) records.save(RankingAdminRecord(recordId, kind, payload)) else row.replace(payload)
    }
    override fun validateSourceKeys(rows: List<com.kgd.ranking.domain.cafe.model.CafeDrink>) {
        if (rows.isEmpty()) return
        // The empty first SELECT carries the real column collations into every bound request row.
        // Never approximate MySQL case/accent/Unicode equality in application code.
        val columns = listOf("brand_slug", "menu_name", "temperature", "size_label", "caffeine_status")
        val values = rows.map { listOf(it.brandSlug, it.menuName, it.temperature.orEmpty(), it.sizeLabel.orEmpty(), it.caffeineStatus.name) }
        val derived = "SELECT ${columns.joinToString()} FROM cafe_drink WHERE 1=0 UNION ALL " + values.indices.joinToString(" UNION ALL ") { index -> "SELECT " + columns.indices.joinToString { ":v${index}_$it" } }
        fun query(sql: String): List<*> {
            val query = entityManager.createNativeQuery(sql)
            values.forEachIndexed { i, fields -> fields.forEachIndexed { j, value -> query.setParameter("v${i}_$j", value) } }
            return query.resultList
        }
        require(query("SELECT COUNT(*) FROM ($derived) r GROUP BY ${columns.joinToString { "r.$it" }} HAVING COUNT(*) > 1").isEmpty()) { "DB-equivalent input natural keys" }
        val brandPairs = query("SELECT DISTINCT d.brand_slug, r.brand_slug FROM cafe_drink d JOIN ($derived) r ON d.brand_slug=r.brand_slug")
        require(brandPairs.all { pair -> val fields = pair as Array<*>; fields[0] == fields[1] }) { "DB-equivalent brand alias" }
        val pairs = query("SELECT ${columns.joinToString { "d.$it" }}, ${columns.joinToString { "r.$it" }} FROM cafe_drink d JOIN ($derived) r ON ${columns.joinToString(" AND ") { "d.$it=r.$it" }}")
        require(pairs.all { pair -> val fields = pair as Array<*>; (0..4).all { fields[it] == fields[it + 5] } }) { "DB-equivalent source natural key alias" }
        // Entire retained natural keys reserve their exact spelling even when no live source exists.
        // CafeDrinkKey.fields already normalizes null/empty identity to the persisted empty strings.
        val retained = corrections().mapNotNull { com.kgd.ranking.domain.cafe.model.CafeDrinkKey.fields(it.drinkKey) }
        if (retained.isNotEmpty()) {
            val reserved = "SELECT ${columns.joinToString()} FROM cafe_drink WHERE 1=0 UNION ALL " + retained.indices.joinToString(" UNION ALL ") { index -> "SELECT " + columns.indices.joinToString { ":k${index}_$it" } }
            val sql = "SELECT ${columns.joinToString { "d.$it" }}, ${columns.joinToString { "r.$it" }} FROM ($reserved) d JOIN ($derived) r ON ${columns.joinToString(" AND ") { "d.$it=r.$it" }}"
            val query = entityManager.createNativeQuery(sql)
            retained.forEachIndexed { i, fields -> fields.forEachIndexed { j, value -> query.setParameter("k${i}_$j", value) } }
            values.forEachIndexed { i, fields -> fields.forEachIndexed { j, value -> query.setParameter("v${i}_$j", value) } }
            require(query.resultList.all { pair -> val fields = pair as Array<*>; (0..4).all { fields[it] == fields[it + 5] } }) { "DB-equivalent retained natural key alias" }
        }
        // Retained generations/corrections also reserve their exact brand spelling after disappearance.
        brands().map { it.brandSlug }.distinct().forEach { known ->
            val sql = "SELECT r.brand_slug FROM ($derived) r WHERE r.brand_slug=:known"
            val query = entityManager.createNativeQuery(sql).setParameter("known", known)
            values.forEachIndexed { i, fields -> fields.forEachIndexed { j, value -> query.setParameter("v${i}_$j", value) } }
            require(query.resultList.all { it == known }) { "DB-equivalent retained brand alias" }
        }
    }
    override fun project(key: String, value: com.kgd.ranking.domain.cafe.model.CafeDrink?) {
        val fields = com.kgd.ranking.domain.cafe.model.CafeDrinkKey.fields(key) ?: error("Invalid key")
        val existing = effectiveDrinks.findByBrandSlugAndMenuNameAndTemperatureAndSizeLabelAndCaffeineStatus(fields[0], fields[1], fields[2], fields[3], com.kgd.ranking.domain.cafe.model.CaffeineStatus.valueOf(fields[4]))
        existing?.let { effectiveDrinks.delete(it); effectiveDrinks.flush() }
        value?.let { effectiveDrinks.save(com.kgd.ranking.infrastructure.persistence.entity.CafeEffectiveDrinkJpaEntity.fromDomain(it)) }
    }
    override fun sourceDrinks() = sourceCache.get() ?: drinks.findAll().map { it.toDomain() }.also { if (cache.get() != null) sourceCache.set(it) }
    override fun corrections() = all("CORRECTION", DrinkCorrections::class.java)
    override fun save(value: DrinkCorrections) = put("CORRECTION", value.drinkKey, value)
    override fun brands() = all("BRAND", BrandVerification::class.java)
    override fun save(value: BrandVerification) = put("BRAND", value.brandSlug, value)
    override fun operation(id: String) = one("OPERATION", id, AdminOperation::class.java)
    override fun save(value: AdminOperation) = put("OPERATION", value.operationId, value)
    override fun audits() = all("AUDIT", AuditEvent::class.java)
    override fun save(value: AuditEvent) = put("AUDIT", value.id, value)
    override fun preview(id: String) = one("PREVIEW", id, GroupPreview::class.java)
    override fun save(value: GroupPreview) = put("PREVIEW", value.previewToken, value)
    override fun runs() = all("INGEST", IngestRun::class.java)
    override fun save(value: IngestRun) = put("INGEST", value.runId, value)
    override fun purgeAudits(before: Instant): Int {
        val expired = records.findByKind("AUDIT").filter { it.updatedAt < before }
        records.deleteAll(expired)
        records.deleteAll(records.findByKind("OPERATION").filter { it.updatedAt < before })
        records.deleteAll(records.findByKind("PREVIEW").filter { it.updatedAt < Instant.now().minusSeconds(86400) })
        return expired.size
    }
    override fun gasBoards() = boards.findAll().map { board ->
        val snapshot = board.latestSnapshotId?.let { snapshots.findById(it).orElse(null) }
        val rows = snapshot?.id?.let(entries::findBySnapshotIdOrderByRankNoAsc).orEmpty()
        val health = when {
            board.latestSnapshotId == null -> "NOT_CREATED"
            snapshot == null || snapshot.boardId != board.id || snapshot.entryCount != rows.size || rows.map { it.rankNo }.distinct().size != rows.size -> "INCONSISTENT"
            snapshot.capturedAt < Instant.now().minusSeconds(36 * 3600) -> "STALE"
            else -> "HEALTHY"
        }
        mapOf("id" to board.id, "slug" to board.slug, "scope" to board.scopeKey, "fuel" to board.slug.substringAfterLast('-'), "title" to board.title,
            "status" to board.status.name, "health" to health, "latestSnapshotId" to board.latestSnapshotId, "capturedAt" to snapshot?.capturedAt, "entryCount" to snapshot?.entryCount, "actualCount" to rows.size)
    }
    override fun gasSnapshots(boardId: Long) = snapshots.findAll().filter { it.boardId == boardId }.sortedByDescending { it.capturedAt }.map { s ->
        mapOf("id" to s.id, "boardId" to s.boardId, "capturedAt" to s.capturedAt, "entryCount" to s.entryCount, "actualCount" to entries.countBySnapshotId(s.id!!), "latest" to (boards.findById(boardId).orElse(null)?.latestSnapshotId == s.id))
    }
    override fun gasSnapshot(snapshotId: Long): Map<String, Any?>? = snapshots.findById(snapshotId).orElse(null)?.let { s ->
        val rows = entries.findBySnapshotIdOrderByRankNoAsc(snapshotId)
        mapOf("id" to s.id, "boardId" to s.boardId, "capturedAt" to s.capturedAt, "entryCount" to s.entryCount, "actualCount" to rows.size,
            "consistent" to (s.entryCount == rows.size && rows.map { it.rankNo }.distinct().size == rows.size && boards.existsById(s.boardId)),
            "entries" to rows.map { mapOf("rank" to it.rankNo, "score" to it.score, "prevRank" to it.prevRank, "subjectKey" to it.subjectKey, "subjectName" to it.subjectName, "payload" to it.payload) })
    }
}

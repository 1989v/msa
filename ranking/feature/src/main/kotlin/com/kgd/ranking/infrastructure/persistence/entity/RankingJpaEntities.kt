package com.kgd.ranking.infrastructure.persistence.entity

import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.domain.model.RankingMetric
import com.kgd.ranking.domain.model.SortDirection
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant

/**
 * 랭킹 보드 (ADR-0081).
 *
 * [latestSnapshotId] 는 스냅샷과 엔트리를 **다 쓴 뒤에** 갱신한다. 먼저 갱신하면 조회가
 * 반쪽짜리 스냅샷을 읽는다 — 배치가 도는 몇 초 동안 화면의 순위가 잘려 보인다.
 */
@Entity
@Table(name = "ranking_board")
class RankingBoardJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 100, unique = true)
    val slug: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    val domain: RankingDomain = RankingDomain.GAS_STATION,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    val metric: RankingMetric = RankingMetric.FUEL_PRICE,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 4)
    val direction: SortDirection = SortDirection.ASC,

    @Column(name = "scope_key", nullable = false, length = 20)
    val scopeKey: String = "",

    scopeName: String = "",
    title: String = "",
    subtitle: String? = null,
    unit: String = "",
    sourceLabel: String = "",
    status: BoardStatus = BoardStatus.OPEN,
) {
    @Column(name = "scope_name", nullable = false, length = 60)
    var scopeName: String = scopeName
        private set

    @Column(nullable = false, length = 150)
    var title: String = title
        private set

    @Column(length = 200)
    var subtitle: String? = subtitle
        private set

    @Column(nullable = false, length = 20)
    var unit: String = unit
        private set

    @Column(name = "source_label", nullable = false, length = 100)
    var sourceLabel: String = sourceLabel
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: BoardStatus = status
        private set

    @Column(name = "latest_snapshot_id")
    var latestSnapshotId: Long? = null
        private set

    /** 전시 문구 갱신 — 관측값([latestSnapshotId])은 건드리지 않는다 (entity-mutation.md) */
    fun updateDisplay(scopeName: String, title: String, subtitle: String?, unit: String, sourceLabel: String) {
        this.scopeName = scopeName
        this.title = title
        this.subtitle = subtitle
        this.unit = unit
        this.sourceLabel = sourceLabel
    }

    fun publishSnapshot(snapshotId: Long) {
        this.latestSnapshotId = snapshotId
    }

    fun toDomain() = RankingBoard(
        id = id,
        slug = slug,
        domain = domain,
        metric = metric,
        direction = direction,
        scopeKey = scopeKey,
        scopeName = scopeName,
        title = title,
        subtitle = subtitle,
        unit = unit,
        sourceLabel = sourceLabel,
        status = status,
    )
}

@Entity
@Table(name = "ranking_snapshot")
class RankingSnapshotJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "board_id", nullable = false)
    val boardId: Long = 0,

    @Column(name = "captured_at", nullable = false)
    val capturedAt: Instant = Instant.EPOCH,

    @Column(name = "entry_count", nullable = false)
    val entryCount: Int = 0,
)

/**
 * 순위 한 줄.
 *
 * [payload] 는 직렬화된 JSON 문자열이다. 도메인별 부가 표시값(브랜드·셀프여부·좌표)을
 * 담으며, 스키마가 강제하지 않으므로 도메인별 계약은 테스트가 지킨다.
 */
@Entity
@Table(name = "ranking_entry")
class RankingEntryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "snapshot_id", nullable = false)
    val snapshotId: Long = 0,

    @Column(name = "rank_no", nullable = false)
    val rankNo: Int = 0,

    @Column(name = "subject_key", nullable = false, length = 120)
    val subjectKey: String = "",

    @Column(name = "subject_name", nullable = false, length = 200)
    val subjectName: String = "",

    @Column(nullable = false, precision = 18, scale = 4)
    val score: BigDecimal = BigDecimal.ZERO,

    /** NULL 은 신규 진입이다 — 0 이나 최하위가 아니다 */
    @Column(name = "prev_rank")
    val prevRank: Int? = null,

    @Column(columnDefinition = "json")
    val payload: String? = null,
)

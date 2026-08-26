package com.kgd.ranking.application.ranking.port

import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain

interface RankingBoardRepositoryPort {
    fun findBySlug(slug: String): RankingBoard?
    fun findByDomainAndScopeKey(domain: RankingDomain, scopeKey: String): List<RankingBoard>
    /** scopeKey 오름차순 */
    fun findByStatus(status: BoardStatus): List<RankingBoard>
    /** id 가 있으면 갱신, 없으면 생성. 관측값(latestSnapshotId)은 null 로 되돌리지 않는다 */
    fun save(board: RankingBoard): RankingBoard
}

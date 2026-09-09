package com.kgd.game.application.roster.port

import com.kgd.game.domain.roster.model.FriendGroup
import java.time.LocalDateTime

/**
 * 계정 저장 옵트인 (ADR-0092). **행의 존재가 곧 켜짐**이다 — 플래그 컬럼을 두면
 * 「꺼졌는데 데이터는 남은」 상태가 생기고, 그것이 방침 위반이다.
 */
interface RosterOptInPort {
    fun isEnabled(memberId: Long): Boolean
    fun enable(memberId: Long)

    /** 끄기 — 옵트인 행만 지운다. 그룹 삭제는 서비스가 순서를 정해 부른다 */
    fun disable(memberId: Long)
}

interface FriendGroupRepositoryPort {
    fun save(group: FriendGroup): FriendGroup
    fun findAllByMember(memberId: Long): List<FriendGroup>
    fun findById(id: Long): FriendGroup?
    fun findByMemberAndName(memberId: Long, name: String): FriendGroup?
    fun delete(id: Long)

    /** 회원 탈퇴·옵트아웃에서 쓴다. 지운 행 수를 돌려준다 */
    fun deleteAllByMember(memberId: Long): Int

    /** 보존기간 정리 — 마지막 사용이 이 시각보다 오래된 그룹을 지운다 */
    fun purgeUnusedBefore(threshold: LocalDateTime): Int
}

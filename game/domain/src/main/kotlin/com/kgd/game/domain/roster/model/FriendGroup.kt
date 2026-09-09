package com.kgd.game.domain.roster.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDateTime

/**
 * 친구 그룹 (ADR-0092) — 파티에서 쓰는 참가자 명부.
 *
 * **그룹은 판 참가자가 아니다.** 오늘 안 온 사람은 시작 전 토글로 이번 판에서만 빼고, 그룹은
 * 그대로 둔다. 그 둘을 한 개념으로 묶으면 매번 명부를 다시 적게 되어 기능의 동기가 사라진다.
 *
 * 별칭은 **실명일 수 있다고 전제한다** — 자유 텍스트라 막을 수 없다. 그래서 이 값은 로그·메트릭·
 * 에러 리포트에 싣지 않고, 서버 저장은 옵트인일 때만 한다.
 */
data class FriendGroup(
    val id: Long? = null,
    val memberId: Long,
    val name: String,
    val aliases: List<String>,
    val lastUsedAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(name.isNotBlank() && name.length <= MAX_NAME) { "그룹 이름은 1~${MAX_NAME}자" }
        if (aliases.size < MIN_MEMBERS || aliases.size > MAX_MEMBERS) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "그룹 인원은 ${MIN_MEMBERS}~${MAX_MEMBERS}명")
        }
        require(aliases.none { it.isBlank() }) { "빈 별칭은 담지 않는다" }
        require(aliases.all { it.length <= MAX_ALIAS }) { "별칭은 ${MAX_ALIAS}자 이하" }
    }

    /** 판에 쓰였다 — 보존기간이 이 시각으로 잰다 */
    fun used(now: LocalDateTime = LocalDateTime.now()): FriendGroup = copy(lastUsedAt = now)

    companion object {
        const val MAX_NAME = 24

        /** 명부 규약의 상한과 같은 값이다 — 화면과 규약이 다른 수를 쓰면 한쪽이 조용히 잘린다 */
        const val MIN_MEMBERS = 2
        const val MAX_MEMBERS = 12
        const val MAX_ALIAS = 12
    }
}

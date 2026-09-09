package com.kgd.game.application.roster.usecase

import com.kgd.game.domain.roster.model.FriendGroup

/**
 * 인바운드 포트 (ADR-0083). 컨트롤러는 **인터페이스만** 주입한다 —
 * 가장 최근 세 도메인이 이 한 겹을 빠뜨린 채 리뷰를 통과했다.
 */
interface ListFriendGroupsUseCase {
    /** 옵트인이 꺼져 있으면 빈 목록이다 — 서버에 아무것도 없는 것이 정상 상태다 */
    fun execute(query: Query): Result

    data class Query(val memberId: Long)
    data class Result(val optedIn: Boolean, val groups: List<FriendGroup>)
}

interface SaveFriendGroupUseCase {
    fun execute(command: Command): FriendGroup

    /**
     * @param overwrite 이름이 겹칠 때 덮을지. **기본은 안 덮는다** — 업로드가 서버(SSOT)를 덮는
     *                  유일한 경로라, 말없이 덮으면 다른 기기에서 만든 그룹이 사라진다.
     */
    data class Command(
        val memberId: Long,
        val id: Long? = null,
        val name: String,
        val aliases: List<String>,
        val overwrite: Boolean = false,
    )
}

interface DeleteFriendGroupUseCase {
    fun execute(command: Command)

    data class Command(val memberId: Long, val groupId: Long)
}

/**
 * 계정 저장 토글.
 *
 * 끌 때 **서버본을 먼저 내려준 뒤** 지운다 — 켜져 있는 동안 서버가 SSOT 였으므로 그냥 지우면
 * 최신본이 사라지고 기기의 낡은 사본만 남는다.
 */
interface SetRosterOptInUseCase {
    fun execute(command: Command): Result

    data class Command(val memberId: Long, val enabled: Boolean)

    /** @param exported 끄기 직전의 서버본. 켤 때는 빈 목록 */
    data class Result(val optedIn: Boolean, val exported: List<FriendGroup>)
}

/**
 * 파기 — 회원 탈퇴와 보존기간 정리가 함께 쓴다.
 *
 * 탈퇴는 방침(§6 「탈퇴 시 지체 없이 파기」)이 요구하는 즉시 파기이고, 보존 정리는 그 호출이
 * 실패했을 때를 받치는 **그물**이다. 둘 다 있어야 한다 — 즉시 호출만 두면 실패가 조용히 남고,
 * 스윕만 두면 「지체 없이」가 아니다.
 */
interface PurgeRostersUseCase {
    fun byMember(memberId: Long): Int
    fun unusedFor(days: Long): Int
}

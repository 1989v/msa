package com.kgd.game.presentation.roster.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.roster.usecase.DeleteFriendGroupUseCase
import com.kgd.game.application.roster.usecase.ListFriendGroupsUseCase
import com.kgd.game.application.roster.usecase.PurgeRostersUseCase
import com.kgd.game.application.roster.usecase.SaveFriendGroupUseCase
import com.kgd.game.application.roster.usecase.SetRosterOptInUseCase
import com.kgd.game.domain.roster.model.FriendGroup
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 친구 그룹 (ADR-0092) — **로그인 전용**. 게이트웨이가 `X-User-Id` 를 주입한다.
 *
 * 컨트롤러는 UseCase 인터페이스만 주입한다 (ADR-0083). 서비스를 직접 받으면 레이어 게이트가 막는다.
 */
@RestController
@RequestMapping("/api/v1/games/party/rosters")
class RosterController(
    private val list: ListFriendGroupsUseCase,
    private val save: SaveFriendGroupUseCase,
    private val delete: DeleteFriendGroupUseCase,
    private val optIn: SetRosterOptInUseCase,
) {

    @GetMapping
    fun list(@RequestHeader("X-User-Id") memberId: Long): ApiResponse<RosterListResponse> =
        ApiResponse.success(RosterListResponse.from(list.execute(ListFriendGroupsUseCase.Query(memberId))))

    /**
     * 계정 저장 토글. 끄면 서버본을 **응답으로 돌려준 뒤** 지운다 — 켜져 있는 동안 서버가
     * SSOT 였으므로, 화면이 그 값을 기기에 내려받아야 최신본이 사라지지 않는다.
     */
    @PutMapping("/opt-in")
    fun setOptIn(
        @RequestHeader("X-User-Id") memberId: Long,
        @RequestBody request: OptInRequest,
    ): ApiResponse<RosterListResponse> {
        val result = optIn.execute(SetRosterOptInUseCase.Command(memberId, request.enabled))
        return ApiResponse.success(
            RosterListResponse(result.optedIn, result.exported.map(FriendGroupResponse::from)),
        )
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestHeader("X-User-Id") memberId: Long,
        @RequestBody request: SaveGroupRequest,
    ): ApiResponse<FriendGroupResponse> =
        ApiResponse.success(FriendGroupResponse.from(save.execute(request.toCommand(memberId, null))))

    @PutMapping("/{groupId}")
    fun update(
        @RequestHeader("X-User-Id") memberId: Long,
        @PathVariable groupId: Long,
        @RequestBody request: SaveGroupRequest,
    ): ApiResponse<FriendGroupResponse> =
        ApiResponse.success(FriendGroupResponse.from(save.execute(request.toCommand(memberId, groupId))))

    @DeleteMapping("/{groupId}")
    fun delete(
        @RequestHeader("X-User-Id") memberId: Long,
        @PathVariable groupId: Long,
    ): ApiResponse<Unit> {
        delete.execute(DeleteFriendGroupUseCase.Command(memberId, groupId))
        return ApiResponse.success(Unit)
    }
}

/**
 * 회원 탈퇴 파기 (ADR-0092 · 방침 §6 「탈퇴 시 지체 없이 파기」).
 *
 * member 는 다른 JVM 이고 outbox·Kafka 를 쓰지 않아 `game_db` 가 탈퇴를 알 채널이 없었다.
 * **동기 호출로 잇되 탈퇴를 막지 않는다** — 실패해도 회원은 탈퇴되고, 놓친 행은 보존 스윕이
 * 그물로 잡는다. 두 겹이라야 「지체 없이」와 「빠짐없이」가 동시에 선다.
 *
 * 내부 전용 경로다 — 게이트웨이는 `/internal` 하위를 외부에 열지 않는다.
 */
@RestController
@RequestMapping("/internal/party/rosters")
class RosterInternalController(
    private val purge: PurgeRostersUseCase,
) {

    @DeleteMapping("/members/{memberId}")
    fun purgeByMember(@PathVariable memberId: Long): ApiResponse<Int> =
        ApiResponse.success(purge.byMember(memberId))
}

data class OptInRequest(val enabled: Boolean)

data class SaveGroupRequest(
    val name: String,
    val aliases: List<String>,
    /** 이름이 겹칠 때 덮을지. 화면이 물어본 뒤에만 참으로 보낸다 */
    val overwrite: Boolean = false,
) {
    fun toCommand(memberId: Long, id: Long?) =
        SaveFriendGroupUseCase.Command(memberId, id, name, aliases, overwrite)
}

data class RosterListResponse(val optedIn: Boolean, val groups: List<FriendGroupResponse>) {
    companion object {
        fun from(result: ListFriendGroupsUseCase.Result) =
            RosterListResponse(result.optedIn, result.groups.map(FriendGroupResponse::from))
    }
}

data class FriendGroupResponse(val id: Long, val name: String, val aliases: List<String>) {
    companion object {
        fun from(group: FriendGroup) =
            FriendGroupResponse(group.id!!, group.name, group.aliases)
    }
}

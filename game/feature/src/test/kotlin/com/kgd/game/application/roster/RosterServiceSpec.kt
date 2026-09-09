package com.kgd.game.application.roster

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.roster.port.FriendGroupRepositoryPort
import com.kgd.game.application.roster.port.RosterOptInPort
import com.kgd.game.application.roster.service.RosterService
import com.kgd.game.application.roster.usecase.DeleteFriendGroupUseCase
import com.kgd.game.application.roster.usecase.ListFriendGroupsUseCase
import com.kgd.game.application.roster.usecase.SaveFriendGroupUseCase
import com.kgd.game.application.roster.usecase.SetRosterOptInUseCase
import com.kgd.game.domain.roster.model.FriendGroup
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.maps.shouldBeEmpty as mapShouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

/**
 * ADR-0092 — 친구 그룹.
 *
 * **저장소를 흉내 내되 「행이 있다/없다」로 판정한다.** `verify { port.delete(...) }` 형태로 쓰면
 * 하드 삭제를 소프트 삭제로 바꾸는 회귀가 그대로 통과한다 — 호출은 그대로 일어나기 때문이다.
 */
private class FakeGroups : FriendGroupRepositoryPort {
    val rows = mutableMapOf<Long, FriendGroup>()
    private var seq = 0L

    override fun save(group: FriendGroup): FriendGroup {
        val id = group.id ?: ++seq
        val saved = group.copy(id = id)
        rows[id] = saved
        return saved
    }

    override fun findAllByMember(memberId: Long) = rows.values.filter { it.memberId == memberId }
    override fun findById(id: Long) = rows[id]
    override fun findByMemberAndName(memberId: Long, name: String) =
        rows.values.firstOrNull { it.memberId == memberId && it.name == name }

    override fun delete(id: Long) { rows.remove(id) }

    override fun deleteAllByMember(memberId: Long): Int {
        val hit = rows.filterValues { it.memberId == memberId }.keys.toList()
        hit.forEach { rows.remove(it) }
        return hit.size
    }

    override fun purgeUnusedBefore(threshold: LocalDateTime): Int {
        val hit = rows.filterValues { it.lastUsedAt < threshold }.keys.toList()
        hit.forEach { rows.remove(it) }
        return hit.size
    }
}

private class FakeOptIn : RosterOptInPort {
    val on = mutableSetOf<Long>()
    override fun isEnabled(memberId: Long) = memberId in on
    override fun enable(memberId: Long) { on += memberId }
    override fun disable(memberId: Long) { on -= memberId }
}

private const val ME = 7L
private val TRIO = listOf("민수", "영희", "철수")

class RosterServiceSpec : BehaviorSpec({

    fun fixture(): Triple<RosterService, FakeGroups, FakeOptIn> {
        val g = FakeGroups()
        val o = FakeOptIn()
        return Triple(RosterService(g, o), g, o)
    }

    fun saved(svc: RosterService, name: String = "주말팀") =
        svc.execute(SaveFriendGroupUseCase.Command(ME, null, name, TRIO))

    // ── T31 · T47 — 옵트인 전과 켠 직후 ─────────────────────────────────────

    Given("계정 저장이 꺼져 있을 때") {
        val (svc, groups, _) = fixture()

        Then("목록은 비어 있고 꺼짐으로 보고된다") {
            val r = svc.execute(ListFriendGroupsUseCase.Query(ME))
            r.optedIn shouldBe false
            r.groups.shouldBeEmpty()
        }
        Then("저장 자체가 거부된다 — 동의 없이 남의 이름이 서버로 가지 않는다") {
            shouldThrow<BusinessException> { saved(svc) }
            groups.rows.mapShouldBeEmpty()
        }
    }

    Given("계정 저장을 방금 켰을 때") {
        val (svc, groups, optIn) = fixture()

        When("켜기만 하면") {
            val r = svc.execute(SetRosterOptInUseCase.Command(ME, true))

            Then("켜졌다고 보고한다") {
                r.optedIn shouldBe true
                optIn.isEnabled(ME) shouldBe true
            }
            Then("**아무것도 자동으로 올라가지 않는다**") {
                groups.rows.mapShouldBeEmpty()
                r.exported.shouldBeEmpty()
            }
        }
    }

    // ── T28 — 옵트아웃 후 행이 없다 ────────────────────────────────────────

    Given("그룹이 저장된 회원이 계정 저장을 끌 때") {
        val (svc, groups, optIn) = fixture()
        svc.execute(SetRosterOptInUseCase.Command(ME, true))
        saved(svc, "주말팀")
        saved(svc, "회식팀")

        When("끄면") {
            val r = svc.execute(SetRosterOptInUseCase.Command(ME, false))

            Then("서버에 **행이 남지 않는다**") {
                groups.rows.mapShouldBeEmpty()
                svc.execute(ListFriendGroupsUseCase.Query(ME)).groups.shouldBeEmpty()
            }
            Then("옵트인도 함께 꺼진다") {
                optIn.isEnabled(ME) shouldBe false
            }
            Then("끄기 직전의 서버본을 돌려준다 — 최신본이 사라지지 않게") {
                r.exported.map { it.name } shouldContainExactly listOf("주말팀", "회식팀")
            }
        }
    }

    // ── T29 — 회원 탈퇴 시 파기 ────────────────────────────────────────────

    Given("탈퇴하는 회원") {
        val (svc, groups, optIn) = fixture()
        svc.execute(SetRosterOptInUseCase.Command(ME, true))
        saved(svc)
        svc.execute(SetRosterOptInUseCase.Command(99L, true))
        // 남의 그룹은 건드리면 안 된다
        svc.execute(SaveFriendGroupUseCase.Command(99L, null, "남의팀", TRIO))

        When("탈퇴 파기를 부르면") {
            val removed = svc.byMember(ME)

            Then("그 회원의 행이 사라진다") {
                removed shouldBe 1
                groups.rows.values.none { it.memberId == ME } shouldBe true
                optIn.isEnabled(ME) shouldBe false
            }
            Then("남의 그룹은 그대로다") {
                groups.rows.values.count { it.memberId == 99L } shouldBe 1
                optIn.isEnabled(99L) shouldBe true
            }
        }
    }

    // ── T30 — 보존 스윕이 실제로 지운다 ────────────────────────────────────

    Given("오래 안 쓴 그룹과 최근에 쓴 그룹") {
        val (svc, groups, _) = fixture()
        svc.execute(SetRosterOptInUseCase.Command(ME, true))
        val fresh = saved(svc, "최근팀")
        val stale = saved(svc, "묵은팀")
        groups.rows[stale.id!!] = stale.copy(lastUsedAt = LocalDateTime.now().minusDays(400))

        When("보존 스윕을 돌리면") {
            val removed = svc.unusedFor(365)

            Then("오래된 것만 사라진다") {
                removed shouldBe 1
                groups.rows.keys shouldContainExactly listOf(fresh.id!!)
            }
        }
    }

    // ── T32 — 켜져 있으면 서버가 SSOT ──────────────────────────────────────

    Given("서버에 그룹이 있는 상태") {
        val (svc, _, _) = fixture()
        svc.execute(SetRosterOptInUseCase.Command(ME, true))
        saved(svc, "주말팀")

        Then("목록은 서버본을 낸다") {
            svc.execute(ListFriendGroupsUseCase.Query(ME)).groups.single().aliases shouldContainExactly TRIO
        }

        When("같은 이름으로 다른 명부를 올리면") {
            Then("덮지 않고 알린다 — 다른 기기에서 만든 그룹이 사라지면 안 된다") {
                shouldThrow<BusinessException> {
                    svc.execute(SaveFriendGroupUseCase.Command(ME, null, "주말팀", listOf("가", "나")))
                }
                svc.execute(ListFriendGroupsUseCase.Query(ME)).groups.single().aliases shouldContainExactly TRIO
            }
            Then("덮겠다고 하면 덮는다") {
                svc.execute(SaveFriendGroupUseCase.Command(ME, null, "주말팀", listOf("가", "나"), overwrite = true))
                svc.execute(ListFriendGroupsUseCase.Query(ME)).groups.single().aliases shouldContainExactly listOf("가", "나")
            }
        }
    }

    // ── 남의 그룹 ──────────────────────────────────────────────────────────

    Given("남의 그룹 id") {
        val (svc, groups, _) = fixture()
        svc.execute(SetRosterOptInUseCase.Command(99L, true))
        val theirs = svc.execute(SaveFriendGroupUseCase.Command(99L, null, "남의팀", TRIO))

        Then("지울 수 없다") {
            shouldThrow<BusinessException> { svc.execute(DeleteFriendGroupUseCase.Command(ME, theirs.id!!)) }
            groups.rows.containsKey(theirs.id!!) shouldBe true
        }
    }
})

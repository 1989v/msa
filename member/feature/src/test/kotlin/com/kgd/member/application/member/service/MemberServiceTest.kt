package com.kgd.member.application.member.service

import com.kgd.member.application.member.port.MemberRepositoryPort
import com.kgd.member.application.member.usecase.GetMemberProfileUseCase
import com.kgd.member.application.member.usecase.GetOrCreateMemberUseCase
import com.kgd.member.application.member.usecase.UpdateMemberNameUseCase
import com.kgd.member.application.member.usecase.WithdrawMemberUseCase
import com.kgd.member.domain.exception.MemberNotFoundException
import com.kgd.member.domain.model.Member
import com.kgd.member.domain.model.MemberStatus
import com.kgd.member.domain.model.SsoProvider
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class MemberServiceTest : BehaviorSpec({
    val memberRepository = mockk<MemberRepositoryPort>()
    val service = MemberService(memberRepository)

    fun stored(id: Long, status: MemberStatus = MemberStatus.ACTIVE, name: String = "푸른 고래") =
        Member.restore(id, name, SsoProvider.KAKAO, "hashed-sub", status, LocalDateTime.of(2026, 1, 1, 0, 0))

    beforeEach { clearMocks(memberRepository) }

    given("소셜 로그인으로 회원을 찾거나 만들 때") {
        `when`("같은 제공자·식별값의 회원이 이미 있으면") {
            then("기존 id 를 돌려주고 새로 저장하지 않는다") {
                every { memberRepository.findBySsoProviderAndSsoProviderId(SsoProvider.KAKAO, "hashed-sub") } returns stored(11L)

                val result = service.execute(GetOrCreateMemberUseCase.Command(SsoProvider.KAKAO, "hashed-sub"))

                result.id shouldBe 11L
                result.isNewMember shouldBe false
                verify(exactly = 0) { memberRepository.save(any()) }
            }
        }
        `when`("처음 보는 식별값이면") {
            then("표시 이름을 만들어 저장하고 신규 회원으로 돌려준다") {
                val captured = slot<Member>()
                every { memberRepository.findBySsoProviderAndSsoProviderId(SsoProvider.GOOGLE, "new-sub") } returns null
                every { memberRepository.save(capture(captured)) } returns stored(12L)

                val result = service.execute(GetOrCreateMemberUseCase.Command(SsoProvider.GOOGLE, "new-sub"))

                result.id shouldBe 12L
                result.isNewMember shouldBe true
                captured.captured.ssoProviderId shouldBe "new-sub"
                captured.captured.name.isNotBlank() shouldBe true
                captured.captured.status shouldBe MemberStatus.ACTIVE
            }
        }
    }

    given("프로필 조회 시") {
        `when`("회원이 없으면") {
            then("MemberNotFoundException 이 발생한다") {
                every { memberRepository.findById(99L) } returns null
                shouldThrow<MemberNotFoundException> { service.execute(GetMemberProfileUseCase.Query(99L)) }
            }
        }
        `when`("회원이 있으면") {
            then("이름·제공자·상태를 돌려준다") {
                every { memberRepository.findById(11L) } returns stored(11L)

                val result = service.execute(GetMemberProfileUseCase.Query(11L))

                result.name shouldBe "푸른 고래"
                result.ssoProvider shouldBe "KAKAO"
                result.status shouldBe MemberStatus.ACTIVE
            }
        }
    }

    given("이름 변경 시") {
        `when`("새 이름이 주어지면") {
            then("바뀐 이름으로 저장한다") {
                val captured = slot<Member>()
                every { memberRepository.findById(11L) } returns stored(11L)
                every { memberRepository.save(capture(captured)) } answers { captured.captured }

                service.execute(UpdateMemberNameUseCase.Command(11L, "붉은 여우"))

                captured.captured.name shouldBe "붉은 여우"
            }
        }
        `when`("새 이름이 비어 있으면") {
            then("도메인 불변식이 막고 저장하지 않는다") {
                every { memberRepository.findById(11L) } returns stored(11L)
                shouldThrow<IllegalArgumentException> { service.execute(UpdateMemberNameUseCase.Command(11L, " ")) }
                verify(exactly = 0) { memberRepository.save(any()) }
            }
        }
    }

    given("탈퇴 시") {
        `when`("활성 회원이면") {
            then("WITHDRAWN 상태로 저장한다") {
                val captured = slot<Member>()
                every { memberRepository.findById(11L) } returns stored(11L)
                every { memberRepository.save(capture(captured)) } answers { captured.captured }

                service.execute(WithdrawMemberUseCase.Command(11L))

                captured.captured.status shouldBe MemberStatus.WITHDRAWN
            }
        }
        `when`("이미 탈퇴한 회원이면") {
            then("상태 전이가 거부되고 저장하지 않는다") {
                every { memberRepository.findById(11L) } returns stored(11L, MemberStatus.WITHDRAWN)
                shouldThrow<IllegalStateException> { service.execute(WithdrawMemberUseCase.Command(11L)) }
                verify(exactly = 0) { memberRepository.save(any()) }
            }
        }
    }
})

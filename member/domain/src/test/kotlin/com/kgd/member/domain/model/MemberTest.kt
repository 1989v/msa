package com.kgd.member.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MemberTest : BehaviorSpec({
    Given("회원 생성") {
        When("유효한 정보로 생성하면") {
            val member = Member.create(
                email = "test@example.com",
                name = "홍길동",
                ssoProvider = SsoProvider.KAKAO,
                ssoProviderId = "kakao-123"
            )
            Then("회원이 생성된다") {
                member.email shouldBe "test@example.com"
                member.name shouldBe "홍길동"
                member.ssoProvider shouldBe SsoProvider.KAKAO
                member.status shouldBe MemberStatus.ACTIVE
                member.id shouldBe null
            }
        }

        When("이메일이 비어있으면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Member.create(email = "", name = "홍길동", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")
                }
            }
        }

        When("이름이 비어있으면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Member.create(email = "test@example.com", name = "", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")
                }
            }
        }
    }

    Given("이름 수정") {
        val member = Member.create(email = "test@example.com", name = "홍길동", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")

        When("유효한 이름으로 수정하면") {
            member.updateName("김철수")
            Then("이름이 변경된다") {
                member.name shouldBe "김철수"
            }
        }

        When("빈 이름으로 수정하면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    member.updateName("")
                }
            }
        }
    }

    Given("회원 탈퇴") {
        When("활성 회원이 탈퇴하면") {
            val member = Member.create(email = "test@example.com", name = "홍길동", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")
            member.withdraw()
            Then("상태가 WITHDRAWN이 된다") {
                member.status shouldBe MemberStatus.WITHDRAWN
            }
        }
    }

    Given("회원 정지 및 활성화") {
        When("활성 회원을 정지하면") {
            val member = Member.create(email = "test@example.com", name = "홍길동", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")
            member.suspend()
            Then("상태가 SUSPENDED가 된다") {
                member.status shouldBe MemberStatus.SUSPENDED
            }
        }

        When("정지 회원을 활성화하면") {
            val member = Member.create(email = "test@example.com", name = "홍길동", ssoProvider = SsoProvider.KAKAO, ssoProviderId = "123")
            member.suspend()
            member.activate()
            Then("상태가 ACTIVE가 된다") {
                member.status shouldBe MemberStatus.ACTIVE
            }
        }
    }
})

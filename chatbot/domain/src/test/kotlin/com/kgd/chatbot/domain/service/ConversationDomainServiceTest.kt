package com.kgd.chatbot.domain.service

import com.kgd.chatbot.domain.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ConversationDomainServiceTest : BehaviorSpec({

    val service = ConversationDomainService()

    Given("컨텍스트 윈도우 구성 시") {
        val conversation = Conversation.create(
            channelType = ChannelType.WEB,
            externalChannelId = "test",
            userId = "user-1",
            userRole = UserRole.INTERNAL
        )

        // 각 100 토큰인 메시지 5개 추가
        repeat(5) { i ->
            conversation.addMessage(Message.createUserMessage("메시지 $i", 100))
        }

        When("maxTokens가 250이면") {
            val window = service.buildContextWindow(conversation, 250)

            Then("최근 2개 메시지만 포함된다") {
                window.size shouldBe 2
                window[0].content shouldBe "메시지 3"
                window[1].content shouldBe "메시지 4"
            }
        }

        When("maxTokens가 충분히 크면") {
            val window = service.buildContextWindow(conversation, 10000)

            Then("모든 메시지가 포함된다") {
                window.size shouldBe 5
            }
        }
    }

    Given("접근 검증 시") {
        When("내부 사용자는") {
            val decision = service.validateAccess(UserRole.INTERNAL, "private 설정은?")

            Then("항상 허용된다") {
                decision.allowed shouldBe true
            }
        }

        When("외부 사용자가 private 관련 질문을 하면") {
            val decision = service.validateAccess(UserRole.EXTERNAL, "private 설정은?")

            Then("거부된다") {
                decision.allowed shouldBe false
            }
        }

        When("외부 사용자가 일반 질문을 하면") {
            val decision = service.validateAccess(UserRole.EXTERNAL, "아키텍처 구조 알려줘")

            Then("허용된다") {
                decision.allowed shouldBe true
            }
        }
    }

    Given("토큰 수 추정 시") {
        When("텍스트를 입력하면") {
            val count = service.estimateTokenCount("Hello World 안녕하세요")

            Then("대략적인 토큰 수를 반환한다") {
                // 16 chars / 3.5 ≈ 4
                count shouldBe 4
            }
        }
    }
})

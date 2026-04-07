package com.kgd.chatbot.domain.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ConversationTest : BehaviorSpec({

    Given("새 대화를 생성할 때") {
        When("유효한 정보를 제공하면") {
            val conversation = Conversation.create(
                channelType = ChannelType.WEB,
                externalChannelId = "session-123",
                userId = "user-1",
                userRole = UserRole.INTERNAL
            )

            Then("ACTIVE 상태로 생성된다") {
                conversation.status shouldBe ConversationStatus.ACTIVE
                conversation.channelType shouldBe ChannelType.WEB
                conversation.userId shouldBe "user-1"
                conversation.messages shouldBe emptyList()
            }
        }

        When("채널 ID가 비어있으면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Conversation.create(
                        channelType = ChannelType.WEB,
                        externalChannelId = "",
                        userId = "user-1",
                        userRole = UserRole.INTERNAL
                    )
                }
            }
        }

        When("사용자 ID가 비어있으면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Conversation.create(
                        channelType = ChannelType.WEB,
                        externalChannelId = "session-1",
                        userId = "",
                        userRole = UserRole.INTERNAL
                    )
                }
            }
        }
    }

    Given("활성 대화에") {
        val conversation = Conversation.create(
            channelType = ChannelType.SLACK,
            externalChannelId = "C123:ts123",
            userId = "user-1",
            userRole = UserRole.INTERNAL
        )

        When("메시지를 추가하면") {
            val message = Message.createUserMessage("안녕하세요", 10)
            conversation.addMessage(message)

            Then("메시지가 추가된다") {
                conversation.messages.size shouldBe 1
                conversation.messages[0].content shouldBe "안녕하세요"
            }
        }

        When("대화를 종료하면") {
            conversation.close()

            Then("CLOSED 상태가 된다") {
                conversation.status shouldBe ConversationStatus.CLOSED
            }
        }

        When("종료된 대화에 메시지를 추가하면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalStateException> {
                    conversation.addMessage(Message.createUserMessage("test", 5))
                }
            }
        }
    }
})

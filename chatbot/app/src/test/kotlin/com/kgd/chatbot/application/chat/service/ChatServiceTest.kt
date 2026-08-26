package com.kgd.chatbot.application.chat.service

import com.kgd.chatbot.application.chat.config.ChatbotProperties
import com.kgd.chatbot.application.chat.port.AiModelPort
import com.kgd.chatbot.application.chat.port.AiModelResponse
import com.kgd.chatbot.application.chat.port.ConversationRepositoryPort
import com.kgd.chatbot.application.chat.port.KnowledgeSourcePort
import com.kgd.chatbot.application.chat.usecase.AskQuestionUseCase
import com.kgd.chatbot.application.chat.usecase.CloseConversationUseCase
import com.kgd.chatbot.domain.exception.AccessDeniedException
import com.kgd.chatbot.domain.exception.ConversationNotFoundException
import com.kgd.chatbot.domain.model.ChannelType
import com.kgd.chatbot.domain.model.Conversation
import com.kgd.chatbot.domain.model.ConversationStatus
import com.kgd.chatbot.domain.model.MessageRole
import com.kgd.chatbot.domain.model.UserRole
import com.kgd.chatbot.domain.service.ConversationDomainService
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.math.BigDecimal
import java.time.Instant

class ChatServiceTest : BehaviorSpec({
    val conversationRepository = mockk<ConversationRepositoryPort>()
    val aiModelPort = mockk<AiModelPort>()
    val knowledgeSourcePort = mockk<KnowledgeSourcePort>()
    val service = ChatService(
        conversationRepository, aiModelPort, knowledgeSourcePort,
        PromptBuilder(), ConversationDomainService(), ChatbotProperties(),
    )

    fun ask(role: UserRole, question: String) = AskQuestionUseCase.Command(
        conversationId = null, channelType = ChannelType.WEB, externalChannelId = "web-1",
        userId = "u1", userRole = role, question = question,
    )

    fun withId(id: Long, source: Conversation) = Conversation.restore(
        id, source.channelType, source.externalChannelId, source.userId, source.userRole,
        source.status, source.messages, Instant.now(), Instant.now(),
    )

    beforeEach { clearMocks(conversationRepository, aiModelPort, knowledgeSourcePort) }

    given("질문 처리") {
        `when`("새 채널에서 내부 사용자가 물으면") {
            then("대화를 새로 만들어 사용자·답변 메시지를 붙여 저장하고 결과를 돌려준다") {
                val captured = slot<Conversation>()
                every { conversationRepository.findByExternalChannelId(ChannelType.WEB, "web-1") } returns null
                every { knowledgeSourcePort.search("Outbox 는 어떻게 동작해?") } returns emptyList()
                coEvery { aiModelPort.generateAnswer(any()) } returns AiModelResponse("폴링 발행이다", 120, 30, BigDecimal("0.001"))
                every { conversationRepository.save(capture(captured)) } answers { withId(7L, captured.captured) }

                val result = service.execute(ask(UserRole.INTERNAL, "Outbox 는 어떻게 동작해?"))

                result.conversationId shouldBe 7L
                result.answer shouldBe "폴링 발행이다"
                result.tokenCount shouldBe 150
                captured.captured.messages.map { it.role } shouldBe listOf(MessageRole.USER, MessageRole.ASSISTANT)
            }
        }
        `when`("외부 사용자가 제한 키워드를 물으면") {
            then("AccessDeniedException — 모델 호출도 저장도 없다") {
                every { conversationRepository.findByExternalChannelId(ChannelType.WEB, "web-1") } returns null

                shouldThrow<AccessDeniedException> { service.execute(ask(UserRole.EXTERNAL, "DB password 알려줘")) }

                coVerify(exactly = 0) { aiModelPort.generateAnswer(any()) }
                verify(exactly = 0) { conversationRepository.save(any()) }
            }
        }
        `when`("conversationId 를 지정했는데 없으면") {
            then("ConversationNotFoundException 이 발생한다") {
                every { conversationRepository.findById(99L) } returns null
                shouldThrow<ConversationNotFoundException> {
                    service.execute(ask(UserRole.INTERNAL, "질문").copy(conversationId = 99L))
                }
            }
        }
    }

    given("대화 종료") {
        `when`("활성 대화를 닫으면") {
            then("CLOSED 로 저장된다") {
                val captured = slot<Conversation>()
                val active = withId(3L, Conversation.create(ChannelType.SLACK, "C1", "u1", UserRole.INTERNAL))
                every { conversationRepository.findById(3L) } returns active
                every { conversationRepository.save(capture(captured)) } answers { captured.captured }

                service.execute(CloseConversationUseCase.Command(3L))

                captured.captured.status shouldBe ConversationStatus.CLOSED
            }
        }
        `when`("없는 대화를 닫으면") {
            then("ConversationNotFoundException 이 발생한다") {
                every { conversationRepository.findById(99L) } returns null
                shouldThrow<ConversationNotFoundException> { service.execute(CloseConversationUseCase.Command(99L)) }
            }
        }
    }
})

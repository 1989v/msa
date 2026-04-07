package com.kgd.chatbot.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class ConversationNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "대화(id=$id)를 찾을 수 없습니다")

class AccessDeniedException(reason: String) :
    BusinessException(ErrorCode.FORBIDDEN, reason)

class AiModelException(message: String) :
    BusinessException(ErrorCode.EXTERNAL_API_ERROR, "AI 모델 호출 실패: $message")

class BudgetExceededException(message: String) :
    BusinessException(ErrorCode.FORBIDDEN, message)

class RateLimitExceededException :
    BusinessException(ErrorCode.FORBIDDEN, "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요")

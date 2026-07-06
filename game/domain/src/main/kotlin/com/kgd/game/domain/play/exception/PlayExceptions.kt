package com.kgd.game.domain.play.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class SessionNotFoundException(sessionKey: String) :
    BusinessException(ErrorCode.NOT_FOUND, "플레이 세션(sessionKey=$sessionKey)을 찾을 수 없습니다")

class SessionAlreadyEndedException(sessionKey: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 종료된 플레이 세션입니다: $sessionKey")

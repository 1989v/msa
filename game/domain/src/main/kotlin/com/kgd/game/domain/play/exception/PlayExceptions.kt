package com.kgd.game.domain.play.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class SessionNotFoundException(sessionKey: String) :
    BusinessException(ErrorCode.NOT_FOUND, "플레이 세션(sessionKey=$sessionKey)을 찾을 수 없습니다")

class SessionAlreadyEndedException(sessionKey: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 종료된 플레이 세션입니다: $sessionKey")

class RunNotFoundException(runKey: String) :
    BusinessException(ErrorCode.NOT_FOUND, "런(runKey=$runKey)을 찾을 수 없습니다")

class RunAlreadyConsumedException(runKey: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 종료된 런입니다: $runKey")

class SaveVersionConflictException(expected: Long, actual: Long) :
    BusinessException(ErrorCode.INVALID_INPUT, "세이브 버전 충돌 — 요청 version=$expected, 현재 version=$actual. 다시 로드 후 저장하세요")

class SaveTooLargeException(size: Int, limit: Int) :
    BusinessException(ErrorCode.INVALID_INPUT, "세이브 데이터가 너무 큽니다 (${size}B > ${limit}B)")

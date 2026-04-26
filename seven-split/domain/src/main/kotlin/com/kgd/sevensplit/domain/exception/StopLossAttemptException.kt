package com.kgd.sevensplit.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * INV-02: 손실 매도(Stop-loss) 시도를 감지했을 때.
 *
 * - 7분할 전략은 진입가 대비 목표 수익률 이상에서만 매도할 수 있다.
 * - 이보다 낮은 가격으로 매도 체결을 시도하면 이 예외가 발생한다.
 *
 * TODO: ErrorCode.SEVEN_SPLIT_STOP_LOSS_ATTEMPT 를 common 모듈에 추가.
 */
class StopLossAttemptException(
    message: String
) : BusinessException(errorCode = ErrorCode.INVALID_INPUT, message = message)

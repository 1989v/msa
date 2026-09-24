package com.kgd.seller.domain.seller.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/** 정산 계좌번호 평문 — 신청 처리 중에만 존재하고 저장되지 않는다(암호문과 표시값만 저장). */
class AccountNumber private constructor(val value: String) {

    /** 화면·로그용 표시값 — 끝 4자리만 드러낸다 */
    fun masked(): String = "*".repeat(value.length - VISIBLE_DIGITS) + value.takeLast(VISIBLE_DIGITS)

    override fun toString(): String = masked()

    companion object {
        private const val VISIBLE_DIGITS = 4
        private val DIGITS = Regex("^\\d{6,20}$")

        fun of(raw: String): AccountNumber {
            val digits = raw.replace("-", "").replace(" ", "")
            if (!DIGITS.matches(digits)) {
                throw BusinessException(ErrorCode.INVALID_INPUT, "계좌번호는 숫자 6~20자리여야 합니다")
            }
            return AccountNumber(digits)
        }
    }
}

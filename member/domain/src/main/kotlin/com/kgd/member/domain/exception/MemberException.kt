package com.kgd.member.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class MemberNotFoundException : BusinessException(
    errorCode = ErrorCode.NOT_FOUND,
    message = "회원을 찾을 수 없습니다"
)

class MemberAlreadyWithdrawnException : BusinessException(
    errorCode = ErrorCode.INVALID_INPUT,
    message = "이미 탈퇴한 회원입니다"
)

class MemberDuplicateException : BusinessException(
    errorCode = ErrorCode.DUPLICATE_RESOURCE,
    message = "이미 가입된 회원입니다"
)

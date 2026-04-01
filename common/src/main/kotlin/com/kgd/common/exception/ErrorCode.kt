package com.kgd.common.exception

enum class ErrorCode(val message: String) {
    // 공통
    INVALID_INPUT("입력값이 올바르지 않습니다"),
    NOT_FOUND("리소스를 찾을 수 없습니다"),
    UNAUTHORIZED("인증이 필요합니다"),
    FORBIDDEN("권한이 없습니다"),
    INTERNAL_ERROR("내부 서버 오류가 발생했습니다"),
    DUPLICATE_RESOURCE("이미 존재하는 리소스입니다"),

    // 외부 서비스
    CIRCUIT_BREAKER_OPEN("서비스가 일시적으로 사용 불가능합니다"),
    EXTERNAL_API_ERROR("외부 API 호출에 실패했습니다"),
    TIMEOUT("요청 처리 시간이 초과되었습니다"),

    // 비즈니스
    INSUFFICIENT_STOCK("재고가 부족합니다"),
    INVALID_ORDER_STATUS("유효하지 않은 주문 상태입니다"),
    INVALID_PRODUCT_STATUS("유효하지 않은 상품 상태입니다"),
    INVALID_GIFTICON_STATUS("유효하지 않은 기프티콘 상태입니다"),
    OCR_EXTRACTION_FAILED("OCR 텍스트 추출에 실패했습니다")
}

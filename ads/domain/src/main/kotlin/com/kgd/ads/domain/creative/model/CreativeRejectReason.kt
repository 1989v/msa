package com.kgd.ads.domain.creative.model

/** 반려 사유 고정 목록. 규제 업권은 의료·금융(ADR-0069 과 같은 기준). */
enum class CreativeRejectReason {
    REGULATED_INDUSTRY,
    ADULT,
    GAMBLING,
    MISLEADING,
    LANDING_MISMATCH,
    IMAGE_QUALITY,
}

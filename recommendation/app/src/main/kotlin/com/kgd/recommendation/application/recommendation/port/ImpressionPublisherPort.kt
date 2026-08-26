package com.kgd.recommendation.application.recommendation.port

import com.kgd.recommendation.domain.recommendation.model.Recommendation

/** 노출 이벤트 발행 (Phase 7). 실패해도 추천 응답은 영향 없어야 한다 */
interface ImpressionPublisherPort {
    fun publishImpressions(rec: Recommendation, variant: String)
}

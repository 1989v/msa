package com.kgd.place.domain.attraction.model

/**
 * 벡터 공간 식별자 (ADR-0090 D2).
 *
 * 모델·리비전·차원 중 **하나라도** 다르면 다른 공간이라 코사인 비교가 성립하지 않는다. 그래서 셋을 한 문자열로 묶어
 * 행마다 박고, 검색은 설정에 적힌 하나만 본다. 모델 교체 = 새 스탬프 = 전량 재임베딩.
 */
data class EmbeddingModelRef(val modelId: String, val revision: String, val dim: Int) {

    val value: String get() = "$modelId@$revision#d$dim"

    init {
        require(modelId.isNotBlank()) { "modelId 는 비어있을 수 없습니다" }
        require('@' !in modelId && '#' !in modelId) { "modelId 에 @ 나 # 를 쓸 수 없습니다: $modelId" }
        require(revision.length == REVISION_LENGTH && revision.all { it.isLetterOrDigit() }) {
            "revision 은 $REVISION_LENGTH 자 영숫자여야 합니다: $revision"
        }
        require(dim in MIN_DIM..MAX_DIM) { "dim 은 $MIN_DIM~$MAX_DIM 이어야 합니다: $dim" }
    }

    override fun toString(): String = value

    companion object {
        const val REVISION_LENGTH = 7
        const val MIN_DIM = 32
        const val MAX_DIM = 16384
        private val FORMAT = Regex("""^(.+)@([A-Za-z0-9]{$REVISION_LENGTH})#d(\d+)$""")

        fun parse(value: String): EmbeddingModelRef {
            val m = FORMAT.matchEntire(value) ?: throw IllegalArgumentException("model_ref 형식이 아닙니다: $value")
            return EmbeddingModelRef(m.groupValues[1], m.groupValues[2], m.groupValues[3].toInt())
        }
    }
}

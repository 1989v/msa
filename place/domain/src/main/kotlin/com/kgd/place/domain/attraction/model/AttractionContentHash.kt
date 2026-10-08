package com.kgd.place.domain.attraction.model

import java.security.MessageDigest

/**
 * 관광지 본문 해시 — 「본문이 실제로 바뀌었나」를 가르는 값이다. 수집은 전량 upsert 라 행 갱신 시각은
 * 전화·이미지만 바뀌어도 오르므로, RSS·IndexNow 가 고르는 「바뀐 주소」는 이 해시가 정한다.
 *
 * 비교 대상은 **자기 이전 값뿐**이다 — search 색인의 `sourceText` 와 같은 결과를 요구하지 않는다.
 * 정규화 규칙이나 [HASH_FIELDS] 를 바꾸면 [VERSION] 을 올린다. 접두가 다른 해시는 「변경」으로 세지 않고
 * 다시 계산만 한다 ([Attraction.syncFrom]) — 안 올리면 규칙을 바꾼 날 전 행이 바뀐 것으로 잡힌다.
 */
object AttractionContentHash {
    const val VERSION = "v1"

    private const val SEPARATOR = "\u001F"
    private val TAG = Regex("<[^>]*>")
    private val WHITESPACE = Regex("[\\s\\p{Z}]+")

    /** 순서가 곧 직렬화 순서다 — 바꾸면 전 행 해시가 바뀐다. */
    private val FIELDS: List<Pair<String, (Attraction) -> Any?>> = listOf(
        "title" to { it.title },
        "overview" to { it.overview },
        "address" to { it.address },
        "tel" to { it.tel },
        "imageUrl" to { it.imageUrl },
        "useTime" to { it.useTime },
        "restDate" to { it.restDate },
        "useFee" to { it.useFee },
        "parking" to { it.parking },
        "parkingFee" to { it.parkingFee },
        "infoCenter" to { it.infoCenter },
        "eventStartDate" to { it.eventStartDate },
        "eventEndDate" to { it.eventEndDate },
        "introRaw" to { it.introRaw },
    )

    val HASH_FIELDS: List<String> = FIELDS.map { it.first }

    fun of(attraction: Attraction): String =
        compute(FIELDS.associate { (name, read) -> name to read(attraction) })

    /** [HASH_FIELDS] 순서로 `필드명=정규화값` 을 이어 SHA-256. 목록에 없는 키는 보지 않는다. */
    fun compute(values: Map<String, Any?>): String {
        val text = HASH_FIELDS.joinToString(SEPARATOR) { name -> "$name=${normalize(values[name])}" }
        val digest = MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
        return "$VERSION:" + digest.joinToString("") { "%02x".format(it) }
    }

    fun isCurrentVersion(stored: String): Boolean = stored.startsWith("$VERSION:")

    // 날짜는 LocalDate.toString() 이 ISO(yyyy-MM-dd) 다.
    private fun normalize(value: Any?): String =
        value?.toString().orEmpty()
            .replace(TAG, "")
            .replace(WHITESPACE, " ")
            .trim()
}

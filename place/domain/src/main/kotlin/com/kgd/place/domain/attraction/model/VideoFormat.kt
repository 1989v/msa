package com.kgd.place.domain.attraction.model

import java.time.Duration

/**
 * 영상 형태 — 쇼츠와 일반(롱폼). YouTube API 에는 쇼츠 여부 필드가 없어 원천 값 둘로 가른다:
 * 길이(`contentDetails.duration`)와 플레이어 비율(`player.embedWidth/Height`, `maxWidth` 를 줘야 비율이 맞게 온다).
 *
 * 세로이고 3분 이하면 쇼츠다. 3분은 쇼츠 길이 상한이고, 세로가 아닌 짧은 영상은 일반 영상으로 둔다
 * (운영 표본 30건: 세로 12건이 전부 3분 이하, 가로이면서 3분 이하가 4건).
 */
enum class VideoFormat {
    LONG,
    SHORT,
    ;

    companion object {
        private val SHORT_MAX: Duration = Duration.ofMinutes(3)

        /** 값 하나라도 없거나 읽을 수 없으면 null — 모르는 것을 일반 영상으로 단정하지 않는다. */
        fun classify(duration: String?, embedWidth: Int?, embedHeight: Int?): VideoFormat? {
            val length = duration?.let { runCatching { Duration.parse(it) }.getOrNull() } ?: return null
            if (embedWidth == null || embedHeight == null || embedWidth <= 0 || embedHeight <= 0) return null
            return if (embedHeight > embedWidth && length <= SHORT_MAX) SHORT else LONG
        }
    }
}

/** 이미 저장된 영상에 나중에 채우는 원천 값(`videos.list`) — 영상 id 하나가 여러 관광지 행에 붙어 있다. */
data class VideoDetails(
    val externalId: String,
    val duration: String?,
    val embedWidth: Int?,
    val embedHeight: Int?,
) {
    val format: VideoFormat? get() = VideoFormat.classify(duration, embedWidth, embedHeight)
}

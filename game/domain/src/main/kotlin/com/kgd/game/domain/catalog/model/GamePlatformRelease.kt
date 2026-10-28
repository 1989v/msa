package com.kgd.game.domain.catalog.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.net.URI
import java.time.Instant

enum class GamePlatform { ROBLOX }
enum class PlatformReleaseStatus { DRAFT, BETA, RELEASED, DISABLED }
enum class PlatformAudience { PUBLIC, INVITE_ONLY }

/** Only a Place ID is persisted. No input URL, query, invitation, or authentication data survives. */
object RobloxPlaceId {
    private val idPattern = Regex("[1-9][0-9]{0,63}")
    fun isValid(value: String?): Boolean = value != null && idPattern.matches(value)
    fun normalize(input: String?): String? {
        val value = input?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        if (isValid(value)) return value
        val uri = try { URI(value) } catch (_: Exception) { invalid() }
        if (uri.scheme != "https" || uri.host !in setOf("www.roblox.com", "roblox.com") ||
            uri.rawUserInfo != null || uri.port != -1 || uri.rawQuery != null || uri.rawFragment != null) invalid()
        val id = Regex("/games/([1-9][0-9]{0,63})(?:/[A-Za-z0-9_-]+)?/?").matchEntire(uri.rawPath ?: "")
            ?.groupValues?.get(1) ?: invalid()
        return id
    }
    fun url(id: String): String {
        if (!isValid(id)) invalid()
        return "https://www.roblox.com/games/$id"
    }
    private fun invalid(): Nothing = throw BusinessException(ErrorCode.INVALID_INPUT, "Roblox 게임 HTTPS 주소 또는 양의 정수 Place ID를 입력하세요 (쿼리·초대·인증 주소 제외)")
}

data class GamePlatformRelease(
    val gameId: Long,
    val platform: GamePlatform,
    val platformRef: String?,
    val releaseStatus: PlatformReleaseStatus,
    val audience: PlatformAudience,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = createdAt,
) {
    init {
        if (platformRef != null && !RobloxPlaceId.isValid(platformRef))
            throw BusinessException(ErrorCode.INVALID_INPUT, "유효한 Place ID가 필요합니다")
        if (releaseStatus in setOf(PlatformReleaseStatus.BETA, PlatformReleaseStatus.RELEASED) && platformRef == null)
            throw BusinessException(ErrorCode.INVALID_INPUT, "베타/정식 버전에는 Place ID가 필요합니다")
    }
    fun isPublic(): Boolean = audience == PlatformAudience.PUBLIC &&
        releaseStatus in setOf(PlatformReleaseStatus.BETA, PlatformReleaseStatus.RELEASED) && RobloxPlaceId.isValid(platformRef)
    fun canonicalUrl(): String? = platformRef?.let(RobloxPlaceId::url)
}

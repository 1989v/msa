package com.kgd.ads.domain.advertiser.model

/**
 * 광고주. `MEMBER` 는 회원 1명당 1행이고 등록 즉시 `ACTIVE` 다.
 * 광고주가 되어도 전역 Role 은 바뀌지 않는다 — 권한은 이 행이 갖는다.
 */
class Advertiser private constructor(
    val id: Long?,
    val kind: AdvertiserKind,
    val memberId: Long?,
    val displayName: String,
    val status: AdvertiserStatus,
) {
    init {
        // SYSTEM(「1989v 하우스」)은 회원도 지갑도 없다 — 회원 id 유무가 곧 종류다.
        require((kind == AdvertiserKind.MEMBER) == (memberId != null)) { "MEMBER 광고주만 회원 id 를 갖습니다" }
    }

    companion object {
        const val MAX_DISPLAY_NAME_LENGTH = 100

        fun registerMember(memberId: Long, displayName: String): Advertiser {
            val name = displayName.trim()
            require(name.isNotEmpty() && name.length <= MAX_DISPLAY_NAME_LENGTH) {
                "광고주 이름은 1~${MAX_DISPLAY_NAME_LENGTH}자여야 합니다"
            }
            return Advertiser(null, AdvertiserKind.MEMBER, memberId, name, AdvertiserStatus.ACTIVE)
        }

        fun restore(
            id: Long,
            kind: AdvertiserKind,
            memberId: Long?,
            displayName: String,
            status: AdvertiserStatus,
        ): Advertiser = Advertiser(id, kind, memberId, displayName, status)
    }
}

package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.GamePlatform
import com.kgd.game.domain.catalog.model.GamePlatformRelease
import com.kgd.game.domain.catalog.model.PlatformAudience
import com.kgd.game.domain.catalog.model.PlatformReleaseStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Enumerated
import jakarta.persistence.EnumType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

@Entity
@Table(name = "game_platform_release", uniqueConstraints = [UniqueConstraint(name = "uk_game_platform_release", columnNames = ["game_id", "platform"])])
class GamePlatformReleaseJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long? = null,
    @Column(name = "game_id", nullable = false) val gameId: Long,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 32) val platform: GamePlatform,
    platformRef: String?,
    releaseStatus: PlatformReleaseStatus,
    audience: PlatformAudience,
    @Column(name = "created_at", nullable = false) val createdAt: Instant,
    updatedAt: Instant,
) {
    @Column(name = "platform_ref", length = 64)
    var platformRef: String? = platformRef
        private set
    @Enumerated(EnumType.STRING)
    @Column(name = "release_status", nullable = false, length = 16)
    var releaseStatus: PlatformReleaseStatus = releaseStatus
        private set
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var audience: PlatformAudience = audience
        private set
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        private set

    fun replace(release: GamePlatformRelease) {
        platformRef = release.platformRef
        releaseStatus = release.releaseStatus
        audience = release.audience
        updatedAt = release.updatedAt
    }
    fun toDomain() = GamePlatformRelease(gameId, platform, platformRef, releaseStatus, audience, createdAt, updatedAt)
    companion object {
        fun fromDomain(r: GamePlatformRelease) = GamePlatformReleaseJpaEntity(null, r.gameId, r.platform,
            r.platformRef, r.releaseStatus, r.audience, r.createdAt, r.updatedAt)
    }
}

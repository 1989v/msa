package com.kgd.ads.infrastructure.persistence.creative.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Immutable
import java.time.LocalDateTime

/**
 * 소재 이미지의 메타데이터 — 결정의 형식 일치 판정이 가로·세로만 읽는다.
 * 이미지 바이트(`bytes`)는 여기 매핑하지 않는다: 후보 인덱스가 1분마다 읽을 때 300KB 씩 끌어오지 않게.
 */
@Entity
@Immutable
@Table(name = "ad_creative_asset")
class CreativeAssetJpaEntity(
    @Id
    @Column(name = "hash", nullable = false, columnDefinition = "CHAR(64)")
    val hash: String,

    @Column(name = "content_type", nullable = false, length = 32)
    val contentType: String,

    @Column(name = "byte_size", nullable = false)
    val byteSize: Int,

    @Column(name = "width", nullable = false)
    val width: Int,

    @Column(name = "height", nullable = false)
    val height: Int,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime,
)

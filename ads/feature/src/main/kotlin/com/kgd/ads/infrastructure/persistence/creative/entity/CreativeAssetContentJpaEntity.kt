package com.kgd.ads.infrastructure.persistence.creative.entity

import jakarta.persistence.Basic
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.Lob
import jakarta.persistence.Table
import org.hibernate.annotations.Immutable

/**
 * 소재 이미지 바이트 — 에셋 응답만 읽는다. 메타데이터([CreativeAssetJpaEntity])와 같은 표를 따로 매핑해
 * 후보 인덱스 갱신이 바이트를 끌어오지 않게 한다.
 */
@Entity
@Immutable
@Table(name = "ad_creative_asset")
class CreativeAssetContentJpaEntity(
    @Id
    @Column(name = "hash", nullable = false, columnDefinition = "CHAR(64)")
    val hash: String,

    @Column(name = "content_type", nullable = false, length = 32)
    val contentType: String,

    @Lob
    @Basic(fetch = FetchType.EAGER)
    @Column(name = "bytes", nullable = false, columnDefinition = "MEDIUMBLOB")
    val bytes: ByteArray,
)

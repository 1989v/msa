package com.kgd.ads.infrastructure.persistence.creative.adapter

import com.kgd.ads.application.creative.dto.StoredImage
import com.kgd.ads.application.creative.port.CreativeAssetStorePort
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.stereotype.Component
import java.time.LocalDateTime

/**
 * 이미지 저장. 표를 두 엔티티(메타·바이트)가 나눠 읽기만 하므로 쓰기는 네이티브 한 줄로 한다.
 * 주소가 내용 해시라 같은 해시는 같은 바이트다 — 이미 있으면 그대로 둔다.
 */
@Component
class CreativeAssetStoreAdapter(
    @Qualifier("adsEntityManagerFactory") emf: EntityManagerFactory,
) : CreativeAssetStorePort {

    private val em: EntityManager = SharedEntityManagerCreator.createSharedEntityManager(emf)

    override fun saveIfAbsent(image: StoredImage, now: LocalDateTime) {
        em.createNativeQuery(
            "INSERT IGNORE INTO ad_creative_asset (hash, content_type, bytes, byte_size, width, height, created_at) " +
                "VALUES (:hash, :contentType, :bytes, :byteSize, :width, :height, :now)",
        )
            .setParameter("hash", image.hash)
            .setParameter("contentType", image.contentType)
            .setParameter("bytes", image.bytes)
            .setParameter("byteSize", image.bytes.size)
            .setParameter("width", image.width)
            .setParameter("height", image.height)
            .setParameter("now", now)
            .executeUpdate()
    }
}

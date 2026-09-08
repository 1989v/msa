package com.kgd.search.infrastructure.client

import com.kgd.search.infrastructure.config.WebClientConfig
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.util.Base64

/**
 * 벡터를 실은 lookup 응답이 WebClient 기본 버퍼(256KB)를 넘는지 — **크기 계산이 근거다.**
 *
 * 이 결함은 벡터가 실제로 있을 때만 드러난다. 첫 채움 전에는 lookup 이 빈 응답이라
 * 한도에 안 걸리고, 채우자마자 재색인이 통째로 실패했다(2026-09-08).
 * 검사는 운영 코드와 **같은 상수**(WebClientConfig.LOOKUP_BUFFER_BYTES)를 본다.
 */
class PlaceApiClientBufferTest : BehaviorSpec({

    val pageSize = 100                 // search.batch.page-size 기본값
    val webClientDefaultLimit = 256 * 1024

    fun base64Bytes(dim: Int) = Base64.getEncoder().encodeToString(ByteArray(dim * 4)).length

    given("벡터를 실은 lookup 응답 크기") {
        `when`("640차원 100건이면") {
            then("WebClient 기본 상한을 넘는다 — 상한을 올리지 않으면 재색인이 실패한다") {
                (base64Bytes(640) * pageSize > webClientDefaultLimit) shouldBe true
            }
        }

        `when`("서버 상한 500건을 1024차원으로 받아도") {
            then("설정한 버퍼 안에 여유 2배로 들어와야 한다") {
                val payload = base64Bytes(1024) * PlaceApiClient.LOOKUP_MAX_BATCH
                (payload * 2 < WebClientConfig.LOOKUP_BUFFER_BYTES) shouldBe true
            }
        }
    }
})

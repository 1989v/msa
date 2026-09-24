package com.kgd.ads.application.creative.dto

import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.creative.model.LandingUrl

/** 클릭이 보낼 곳을 정하는 소재 값. [landingUrl] 은 저장된 값이 랜딩 규칙을 어기면 null. */
data class CreativeLanding(val status: CreativeStatus, val landingUrl: LandingUrl?)

/** 저장된 소재 이미지 한 장. */
class CreativeAsset(val contentType: String, val bytes: ByteArray)

/** 다시 인코딩한 이미지. 가로·세로는 디코딩한 픽셀에서 읽은 값이다. */
class EncodedImage(val bytes: ByteArray, val width: Int, val height: Int)

/** 저장할 소재 이미지 — [hash] 는 [bytes] 의 SHA-256 hex. */
class StoredImage(val hash: String, val contentType: String, val bytes: ByteArray, val width: Int, val height: Int)

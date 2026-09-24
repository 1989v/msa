package com.kgd.ads.application.creative.dto

import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.creative.model.LandingUrl

/** 클릭이 보낼 곳을 정하는 소재 값. [landingUrl] 은 저장된 값이 랜딩 규칙을 어기면 null. */
data class CreativeLanding(val status: CreativeStatus, val landingUrl: LandingUrl?)

/** 저장된 소재 이미지 한 장. */
class CreativeAsset(val contentType: String, val bytes: ByteArray)

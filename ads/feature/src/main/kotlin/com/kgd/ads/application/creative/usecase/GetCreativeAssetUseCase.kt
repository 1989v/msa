package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeAsset

/** 내용 해시로 소재 이미지를 찾는다. 해시 형식이 틀렸거나 없으면 null. */
interface GetCreativeAssetUseCase {
    fun execute(hash: String): CreativeAsset?
}

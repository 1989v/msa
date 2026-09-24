package com.kgd.ads.application.creative.usecase

import com.kgd.ads.application.creative.dto.CreativeAsset

/** 내용 해시로 공개할 소재 이미지를 찾는다. 해시 형식이 틀렸거나, 없거나, 승인된 소재가 쓰지 않는 이미지면 null. */
interface GetCreativeAssetUseCase {
    fun execute(hash: String): CreativeAsset?
}

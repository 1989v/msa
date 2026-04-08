package com.kgd.wishlist.domain.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class WishlistItemNotFoundException : BusinessException(
    errorCode = ErrorCode.NOT_FOUND,
    message = "위시리스트 항목을 찾을 수 없습니다"
)

class WishlistItemDuplicateException : BusinessException(
    errorCode = ErrorCode.DUPLICATE_RESOURCE,
    message = "이미 위시리스트에 추가된 상품입니다"
)

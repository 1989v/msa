package com.kgd.common.shortlink

/** 단축 주소 첫 세그먼트. 이미 퍼진 주소에 박혀 있으므로 [path] 값을 바꾸지 않는다. */
enum class ShortLinkPrefix(val path: String) {
    RESUME("r"),
    PLACE("p"),
    GAME("g"),
    BLOG("b"),
}

package com.kgd.account

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * ADR-0093 — account 모듈러 모놀리스: member + wishlist 도메인 폴드.
 *
 * 묶은 기준은 「사람에 관한 데이터」다. wishlist 의 대상은 상품·게임·관광지·글로 흩어져
 * 있지만 **누가 찜했는가**가 축이고, member 는 그 누구를 정의한다.
 *
 * 두 도메인 모두 전용 datasource 를 갖는다(ADR-0058 불변식 ③). commerce 에 있을 때는
 * inventory 가 primary 였으므로 둘 다 비-@Primary 였는데, 여기서는 member 가 primary 다.
 */
@SpringBootApplication(
    scanBasePackages = [
        "com.kgd.member",
        "com.kgd.wishlist",
        "com.kgd.common.exception",
        "com.kgd.common.response",
    ],
)
@EnableScheduling
class AccountApplication

fun main(args: Array<String>) {
    runApplication<AccountApplication>(*args)
}

package com.kgd.ads.domain.ledger.model

/**
 * 원장 계정 종류.
 * 광고주 지갑은 `MEMBER` 광고주마다 하나, 나머지 셋은 네트워크 전체에 하나씩이다.
 * 충전 원천은 가상 크레딧을 발행하는 쪽이라 음수로 내려간다.
 */
enum class LedgerAccountType { ADVERTISER_WALLET, NETWORK_REVENUE, PUBLISHER_PAYABLE, TOPUP_SOURCE }

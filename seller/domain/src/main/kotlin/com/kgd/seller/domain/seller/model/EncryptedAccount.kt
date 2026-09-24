package com.kgd.seller.domain.seller.model

/**
 * 암호화된 정산 계좌번호. 평문은 도메인 객체에 남지 않는다 — 복호화는 지급 경로의 전용 포트만 한다.
 *
 * @param keyVersion 암호화에 쓴 키 버전. 키를 교체해도 옛 행을 어느 키로 풀지 알 수 있게 행마다 남긴다.
 */
data class EncryptedAccount(val cipherText: String, val keyVersion: Int) {
    override fun toString(): String = "EncryptedAccount(keyVersion=$keyVersion)"
}

package com.kgd.seller.application.seller.port

import com.kgd.seller.domain.seller.model.AccountNumber
import com.kgd.seller.domain.seller.model.EncryptedAccount

/** 정산 계좌 암호화. 복호화는 [com.kgd.seller.application.seller.usecase.RevealPayoutAccountUseCase] 만 부른다. */
interface AccountCipherPort {
    fun encrypt(accountNumber: AccountNumber): EncryptedAccount
    fun decrypt(encrypted: EncryptedAccount): AccountNumber
}

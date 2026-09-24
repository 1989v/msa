package com.kgd.ads.domain.ledger.model

import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/** 금액 표기. 저장·계산은 정수 마이크로이고, 광고주에게 보이는 문구는 크레딧(1 크레딧 = 1,000,000 마이크로)으로 쓴다. */
object Credits {
    const val MICROS_PER_CREDIT = 1_000_000L

    /** 예: 300_000 → "0.3 크레딧", 500_000_000 → "500 크레딧". 소수는 마이크로 자릿수까지만 남긴다. */
    fun format(micros: Long): String {
        val credits = BigDecimal.valueOf(micros).movePointLeft(6)
        return DecimalFormat("#,##0.######", DecimalFormatSymbols(Locale.ROOT)).format(credits) + " 크레딧"
    }
}

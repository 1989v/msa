package com.kgd.quant.infrastructure.security.kms

import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.spec.Spec
import kotlin.reflect.KClass

/**
 * `OciVaultKmsAdapterIntegrationSpec` 의 실행 조건.
 *
 * 다음 두 조건이 모두 만족되어야 활성:
 *  1. `OCI_INTEGRATION=true` 환경변수 (CI nightly 또는 수동 opt-in)
 *  2. 필수 OCI 자격증명 환경변수 7종이 전부 세팅됨
 */
class OciIntegrationCondition : EnabledCondition {

    override fun enabled(kclass: KClass<out Spec>): Boolean {
        if (System.getenv("OCI_INTEGRATION") != "true") return false
        return REQUIRED_ENV.all { !System.getenv(it).isNullOrBlank() }
    }

    companion object {
        private val REQUIRED_ENV = listOf(
            "OCI_TENANCY",
            "OCI_USER",
            "OCI_FINGERPRINT",
            "OCI_PRIVATE_KEY_PATH",
            "OCI_REGION",
            "OCI_VAULT_KEY_OCID",
            "OCI_VAULT_CRYPTO_ENDPOINT"
        )
    }
}

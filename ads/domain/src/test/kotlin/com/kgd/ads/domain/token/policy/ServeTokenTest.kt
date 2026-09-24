package com.kgd.ads.domain.token.policy

import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.token.model.EventRejectReason
import com.kgd.ads.domain.token.model.ServedAd
import com.kgd.ads.domain.token.model.SigningKey
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.model.TokenVerification
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64

class ServeTokenTest : BehaviorSpec({
    val issuedAt = Instant.parse("2026-09-23T01:00:00Z")
    fun clockAt(instant: Instant): Clock = Clock.fixed(instant, ZoneOffset.UTC)

    val keyA = SigningKey.of("a".repeat(32).toByteArray())
    val keyB = SigningKey.of("b".repeat(32).toByteArray())
    val ad = ServedAd(
        decisionId = "d-7f3a", campaignId = 42, creativeId = 420, advertiserId = 7, placementKey = "blog-post-end",
        bidType = BidType.CPM, chargeMicros = 200, billable = true, visitorHash = "9c1f",
    )
    val signer = ServeTokenSigner(keyA, previous = null, clock = clockAt(issuedAt))

    fun verifyAt(instant: Instant, token: String, kind: TokenKind = TokenKind.IMP, visitor: String = "9c1f", current: SigningKey = keyA, previous: SigningKey? = null) =
        ServeTokenSigner(current, previous, clockAt(instant)).verify(token, kind, visitor)

    given("정상 토큰") {
        `when`("발급한 그대로 검증하면") {
            then("서명 대상 전부를 되돌려 준다") {
                val result = verifyAt(issuedAt.plusSeconds(60), signer.issue(TokenKind.IMP, ad))
                result.shouldBeInstanceOf<TokenVerification.Accepted>()
                result.claims.ad shouldBe ad
                result.claims.kind shouldBe TokenKind.IMP
                result.claims.issuedAt shouldBe issuedAt
                result.claims.keyId shouldBe keyA.id
            }
        }
        `when`("수명 2시간이 정확히 끝나는 순간이면") {
            then("아직 받는다") {
                verifyAt(issuedAt.plus(Duration.ofHours(2)), signer.issue(TokenKind.IMP, ad))
                    .shouldBeInstanceOf<TokenVerification.Accepted>()
            }
        }
    }

    given("거절 사유") {
        val token = signer.issue(TokenKind.IMP, ad)
        `when`("서명 대상의 과금액을 바꾸면") {
            then("invalid_signature") {
                val (payload, mac) = token.split('.')
                val forged = String(Base64.getUrlDecoder().decode(payload)).replace("|200|", "|1|")
                val tampered = Base64.getUrlEncoder().withoutPadding().encodeToString(forged.toByteArray()) + "." + mac
                verifyAt(issuedAt, tampered) shouldBe TokenVerification.Rejected(EventRejectReason.INVALID_SIGNATURE, null)
            }
        }
        `when`("서명 바이트를 한 글자 바꾸면") {
            then("invalid_signature") {
                val tampered = token.dropLast(1) + (if (token.last() == 'A') 'B' else 'A')
                verifyAt(issuedAt, tampered) shouldBe TokenVerification.Rejected(EventRejectReason.INVALID_SIGNATURE, null)
            }
        }
        `when`("형식이 깨졌으면") {
            then("invalid_signature") {
                verifyAt(issuedAt, "garbage") shouldBe TokenVerification.Rejected(EventRejectReason.INVALID_SIGNATURE, null)
            }
        }
        `when`("노출 토큰을 클릭으로 내면") {
            then("invalid_signature") {
                verifyAt(issuedAt, token, kind = TokenKind.CLK).shouldBeInstanceOf<TokenVerification.Rejected>()
                    .reason shouldBe EventRejectReason.INVALID_SIGNATURE
            }
        }
        `when`("2시간 1초 뒤면") {
            then("expired — 서명은 맞으니 내용은 함께 준다") {
                val result = verifyAt(issuedAt.plus(Duration.ofHours(2)).plusSeconds(1), token)
                result.shouldBeInstanceOf<TokenVerification.Rejected>()
                result.reason shouldBe EventRejectReason.EXPIRED
                result.claims?.ad shouldBe ad
            }
        }
        `when`("이벤트의 방문자 해시가 다르면") {
            then("visitor_mismatch") {
                verifyAt(issuedAt, token, visitor = "0000").shouldBeInstanceOf<TokenVerification.Rejected>()
                    .reason shouldBe EventRejectReason.VISITOR_MISMATCH
            }
        }
        `when`("과금 여부가 false 로 발급됐으면") {
            then("not_billable") {
                val own = signer.issue(TokenKind.IMP, ad.copy(billable = false))
                verifyAt(issuedAt, own).shouldBeInstanceOf<TokenVerification.Rejected>()
                    .reason shouldBe EventRejectReason.NOT_BILLABLE
            }
        }
    }

    given("키 교체") {
        val oldToken = signer.issue(TokenKind.CLK, ad)
        `when`("새 키가 현재, 옛 키가 이전 키면") {
            then("옛 키로 서명한 토큰도 받는다") {
                verifyAt(issuedAt, oldToken, kind = TokenKind.CLK, current = keyB, previous = keyA)
                    .shouldBeInstanceOf<TokenVerification.Accepted>()
            }
        }
        `when`("이전 키를 내렸으면") {
            then("옛 토큰은 invalid_signature") {
                verifyAt(issuedAt, oldToken, kind = TokenKind.CLK, current = keyB)
                    .shouldBeInstanceOf<TokenVerification.Rejected>().reason shouldBe EventRejectReason.INVALID_SIGNATURE
            }
        }
        `when`("키가 다르면") {
            then("키 id 도 다르다") { keyA.id shouldNotBe keyB.id }
        }
    }

    given("이벤트 한 건의 청구액") {
        `when`("CPM 광고면") {
            then("가시 노출만 1회 과금액, 클릭은 0") {
                ad.chargeFor(TokenKind.IMP) shouldBe 200
                ad.chargeFor(TokenKind.CLK) shouldBe 0
            }
        }
        `when`("CPC 광고면") {
            then("클릭만 1회 과금액, 노출은 0") {
                val cpc = ad.copy(bidType = BidType.CPC, chargeMicros = 150_000)
                cpc.chargeFor(TokenKind.CLK) shouldBe 150_000
                cpc.chargeFor(TokenKind.IMP) shouldBe 0
            }
        }
    }

    given("서명 키 길이") {
        `when`("31바이트면") {
            then("만들 수 없다") { shouldThrow<IllegalArgumentException> { SigningKey.of(ByteArray(31) { 1 }) } }
        }
    }
})

---
parent: 13-crypto-jwt-sso
seq: 12
title: SAML 2.0 + SLO + 세션 vs Token
type: deep
created: 2026-04-28
---

# 12. SAML 2.0

## 핵심

OAuth (Open Authorization)/OIDC (OpenID Connect) 이전에 자리잡은 **기업 SSO (Single Sign-On, 단일 로그인) 표준**. XML 기반.

## 역할

- **IdP (Identity Provider)** — 사용자 인증 + Assertion 발급
- **SP (Service Provider)** — 서비스, IdP 신뢰
- 메타데이터 (XML) 사전 교환으로 신뢰 확립

## 흐름

### SP-initiated SSO

```
1. User → SP/protected
2. SP → User browser로 SAMLRequest (HTTP-Redirect 또는 POST)
3. Browser → IdP/SSO with SAMLRequest
4. IdP가 사용자 인증 (이미 인증돼 있으면 skip)
5. IdP → Browser에 SAMLResponse 폼 (HTTP-POST 바인딩)
6. Browser → SP/ACS로 자동 POST
7. SP가 Assertion 검증 → 세션 생성
```

### IdP-initiated SSO
- 사용자가 IdP 포털에서 시작 (예: 회사 인트라넷의 앱 카탈로그 클릭)
- SP의 ACS(Assertion Consumer Service)로 직접 SAMLResponse POST
- 위험: CSRF/replay 검증이 약해질 수 있음 → SP-init 우선 권장

## Bindings

- **HTTP-Redirect** — URL 쿼리스트링 (요청만, 짧은 메시지)
- **HTTP-POST** — 폼 자동 POST (응답에 주로 사용)
- **Artifact** — IdP에서 받은 ID로 SP가 IdP 백채널에 다시 조회 (보안 ↑, 복잡도 ↑)

## Assertion 구조 (XML)

```xml
<saml:Assertion ID="..." IssueInstant="...">
  <saml:Issuer>https://idp.example.com</saml:Issuer>
  <ds:Signature>...</ds:Signature>
  <saml:Subject>
    <saml:NameID>user@example.com</saml:NameID>
    <saml:SubjectConfirmation Method="bearer">...</saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="..." NotOnOrAfter="...">
    <saml:AudienceRestriction>
      <saml:Audience>https://sp.example.com</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="...">...</saml:AuthnStatement>
  <saml:AttributeStatement>
    <saml:Attribute Name="email">...</saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>
```

## XML Digital Signature (XML-DSig)

```xml
<ds:Signature>
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <ds:Reference URI="#assertion-id">
      <ds:Transforms>...</ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>...</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>...</ds:SignatureValue>
  <ds:KeyInfo>...</ds:KeyInfo>
</ds:Signature>
```

## Canonicalization (C14N)

- XML은 `<a b="1" c="2"/>`와 `<a c="2" b="1"/>`이 의미상 같지만 바이트는 다름
- 서명/검증 전에 **표준 형식**으로 변환 후 해시
- **Exclusive C14N** (xml-exc-c14n) — 권장. 바깥 컨텍스트의 namespace 영향 차단
- Inclusive는 SAML에서 wrapping attack 위험 ↑

## XML Signature Wrapping Attack

- 공격자가 서명된 Assertion을 그대로 두고, 그 옆/안에 자기 Assertion을 추가
- 검증기가 서명은 원본을, 데이터는 공격자 것을 처리하면 우회
- 방어:
  - ID 기반 참조 + 서명된 요소 확정 후에만 사용
  - schema validation 강화
  - 서명 검증 후 XPath 평가 시 같은 요소 보장

## XML Encryption (XML-Enc) — 개략

- Assertion 내부 일부 또는 전체를 암호화
- 거의 사용 안 됨 (TLS로 충분)

## SAML이 OIDC로 대체되는 이유

| 측면 | SAML | OIDC |
|---|---|---|
| 포맷 | XML (장황) | JSON/JWT (간결) |
| 모바일 친화 | ❌ (브라우저 폼 POST) | ✅ |
| API 친화 | ❌ | ✅ (Bearer Token) |
| 라이브러리 | Java 외 부족 | 풍부 |
| 설정 복잡도 | 높음 (메타데이터 XML) | 중간 (Discovery 자동) |

**현재 흐름** — 신규 시스템은 OIDC 우선. SAML은 기존 엔터프라이즈 IdP(ADFS, Shibboleth) 호환 위해 유지.

## Single Logout (SLO)

**문제** — SSO로 한 번 로그인하면 N개 SP에 세션이 생긴다. 한 번에 다 끊고 싶다.

### Front-channel Logout
- 브라우저를 IdP가 N개 SP의 logout URL로 순차 리다이렉트 (또는 iframe으로 동시)
- 단순하나 SP 중 하나라도 응답 안 하면 깨짐
- 브라우저 닫히면 끝

### Back-channel Logout (OIDC RP-Initiated Logout, Front-Channel Logout, Back-Channel Logout 표준)
- IdP가 SP의 logout endpoint로 직접 logout token (JWT) POST
- 안정적이지만 SP 측 endpoint 노출 + 토큰 검증 필요

**현실** — SLO는 잘 안 됨. 보통 IdP만 로그아웃하고 SP는 세션 만료까지 유지하는 것을 수용.

## 세션 vs Token 기반 SSO

| 측면 | 세션 (Cookie 기반 SSO) | Token (Bearer JWT) |
|---|---|---|
| 도메인 모델 | 같은 부모 도메인 (`*.company.com`) | 어느 도메인이든 |
| 모바일 | 어색 | 자연스러움 |
| 만료/취소 | 서버 세션 삭제로 즉시 | Blacklist or 짧은 TTL |
| CSRF | 우려 (SameSite로 완화) | 자동 첨부 안 되니 안전 |

대규모 마이크로서비스 + 모바일 환경에선 Token 기반(OIDC + JWT)이 우세.

## 핵심 포인트

- 신규 시스템은 OIDC 우선 — SAML은 호환 목적
- XML-DSig + C14N + Wrapping Attack은 면접에서 "차이가 뭐냐" 정도로 답변
- SLO는 어렵다는 사실 자체가 답변 (Front-channel/Back-channel 설명)

## 다음 학습

- [13-aws-kms.md](13-aws-kms.md) — 클라우드 키 관리로 전환
- [17-mtls.md](17-mtls.md) — SSO 외 또 다른 강한 인증 메커니즘

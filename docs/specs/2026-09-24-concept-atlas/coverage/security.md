# 보안 — 커버리지 체크리스트

원천:
- 지난 라운드 security.yaml 의 개념 38개(운영 행 포함)
- study/docs/13-crypto-jwt-sso/99-concept-catalog.md (§1-A 갭 52항 · §2 A~J 표) 와 본문 노트 01~24
- docs/adr/ADR-0078-identity-minimization.md · ADR-0079-single-login-origin.md · ADR-0061-edge-exposure-hardening.md · ADR-0077(원장 보존기간)
- 레포 코드: auth · common/security · gateway 필터 · quant 보안(봉투 암호화 · KMS · 2FA · 감사 해시 체인) · ads 토큰 서명 · seller 계좌 암호화 · payment 웹훅 · portal-fe auth.ts · nginx.conf
- 분야 표준: OWASP Top 10(2021) · OWASP ASVS · NIST SP 800-63B(인증) · OAuth 2.0/2.1 · OIDC Core · RFC 7519/7515/7516/7517 · 「Real-World Cryptography」(David Wong) 목차

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| security | 보안 | 기존 파일(운영 행) | placed |
| sec-cryptography | 암호 기초 | 구조 노드 | placed |
| sec-data-protection | 기밀성 보호 | 기존 파일(운영 행) | placed |
| encryption | 암호화 | 기존 파일(운영 행) | placed |
| sec-symmetric-encryption | 대칭키 암호화 | study/13 01 | placed |
| sec-asymmetric-encryption | 비대칭키 암호화 | study/13 01 | placed |
| sec-hybrid-encryption | 하이브리드 암호화 | study/13 01 | placed |
| sec-aes | AES | study/13 99 §A · 02 · 03 | placed |
| sec-block-cipher-mode | 블록 암호 운용 모드 | study/13 99 §A · 02 · 03 | placed |
| sec-mode-ecb | ECB 모드 | study/13 99 §A · 02 · 03 | placed |
| sec-mode-cbc | CBC 모드 | study/13 99 §A · 02 · 03 | placed |
| sec-mode-ctr | CTR 모드 | study/13 99 §A · 02 · 03 | placed |
| sec-aead | AEAD | study/13 99 §A · 02 · 03 | placed |
| sec-aes-gcm | AES-GCM | study/13 99 §A · 02 · 03 | placed |
| sec-chacha20-poly1305 | ChaCha20-Poly1305 | study/13 99 §A · 02 · 03 | placed |
| sec-aes-gcm-siv | AES-GCM-SIV | study/13 99 §A · 21 | placed |
| sec-nonce-reuse | 논스 재사용 | study/13 99 §A · 21 | placed |
| sec-ecb-pattern-leak | ECB 패턴 노출 | study/13 99 §A · 02 · 03 | placed |
| sec-padding-oracle | 패딩 오라클 | study/13 99 §A · 02 · 03 | placed |
| sec-integrity | 무결성 · 진위 확인 | 구조 노드 | placed |
| hashing | 해싱 | 기존 파일(운영 행) | placed |
| sec-sha-2 | SHA-2 | study/13 99 §B · 04 | placed |
| sec-sha-3 | SHA-3 | study/13 99 §B · 04 | placed |
| sec-mac | 메시지 인증 코드 | study/13 99 §B · 06 | placed |
| sec-hmac | HMAC | 기존 파일(운영 행) | placed |
| sec-digital-signature | 디지털 서명 | study/13 99 §B · 07 | placed |
| sec-rsa-pss | RSA-PSS | study/13 99 §B · 07 | placed |
| sec-ecdsa | ECDSA | study/13 99 §B · 07 | placed |
| sec-eddsa | EdDSA · Ed25519 | study/13 99 §B · 07 | placed |
| sec-constant-time-comparison | 상수 시간 비교 | 코드(ads · payment) | placed |
| sec-length-extension-attack | 길이 확장 공격 | study/13 99 §B · 04 | placed |
| sec-timing-attack | 타이밍 공격 | 분야 표준 | placed |
| sec-public-key-crypto | 공개키 암호 · 신뢰 | 구조 노드 | placed |
| sec-rsa | RSA | study/13 99 §B · 07 | placed |
| sec-ecc | 타원 곡선 암호 | study/13 99 §B · 07 | placed |
| sec-diffie-hellman | Diffie-Hellman 키 합의 | study/13 99 §B · 07 | placed |
| sec-post-quantum-crypto | 양자 내성 암호 | study/13 99 §C · 24 | placed |
| sec-hybrid-key-exchange | 하이브리드 키 합의 | study/13 99 §C · 24 | placed |
| sec-harvest-now-decrypt-later | 지금 수집 · 나중 해독 | study/13 99 §C · 24 | placed |
| sec-password-storage | 비밀번호 저장 | 구조 노드 | placed |
| sec-password-hashing | 비밀번호 해싱 | study/13 99 §B · 05 | placed |
| sec-bcrypt | bcrypt | study/13 99 §B · 05 | placed |
| sec-scrypt | scrypt | study/13 99 §B · 05 | placed |
| sec-argon2 | Argon2 | study/13 99 §B · 05 | placed |
| sec-pbkdf2 | PBKDF2 | study/13 99 §B · 05 | placed |
| sec-salt | 솔트 | study/13 99 §B · 05 | placed |
| sec-pepper | 페퍼 | study/13 99 §B · 05 | placed |
| sec-dictionary-attack | 사전 대입 공격 | 기존 파일(운영 행) | placed |
| sec-brute-force | 무차별 대입 | 분야 표준 | placed |
| sec-key-management | 키 관리 | 구조 노드 | placed |
| sec-csprng | 안전 난수 생성 | study/13 99 §B · 21 | placed |
| sec-kdf | 키 유도 함수 | study/13 99 §B · 21 | placed |
| sec-hkdf | HKDF | study/13 99 §B · 21 | placed |
| sec-envelope-encryption | 봉투 암호화 | study/13 99 §I · 13 · 15 | placed |
| sec-key-wrap | 키 래핑 | study/13 99 §A · 21 | placed |
| sec-kms | KMS | study/13 99 §I · 13 · 15 | placed |
| sec-hsm | HSM | study/13 99 §I · 13 · 15 | placed |
| sec-key-rotation | 키 교체 | study/13 99 §I · 13 · 15 | placed |
| sec-reencryption | 재암호화 | 코드(quant 보안) | placed |
| sec-secrets-management | 시크릿 관리 | study/13 99 §I · 13 · 15 | placed |
| sec-crypto-agility | 암호 민첩성 | study/13 99 §B · 21 | placed |
| sec-key-compromise | 키 유출 | study/13 99 §I · 13 · 15 | placed |
| sec-key-loss | 키 분실 | ADR-0078 | placed |
| sec-identity-access | 신원 · 접근 제어 | 구조 노드 | placed |
| sec-authentication | 인증 | 기존 파일(운영 행) | placed |
| sec-password-authentication | 비밀번호 인증 | 분야 표준 | placed |
| sec-password-policy | 비밀번호 정책 | 분야 표준 | placed |
| sec-magic-link | 매직 링크 · 이메일 OTP | study/13 99 §H · 12 | placed |
| sec-mfa | 다중 요소 인증 | study/13 99 §H · 12 | placed |
| sec-totp | TOTP | study/13 99 §H · 12 | placed |
| sec-webauthn | WebAuthn · 패스키 | study/13 99 §H · 12 | placed |
| oauth | OAuth | 기존 파일(운영 행) | placed |
| sec-authorization-code-flow | 인가 코드 흐름 | study/13 99 §F · 10 | placed |
| sec-pkce | PKCE | study/13 99 §F · 10 | placed |
| sec-client-credentials-flow | 클라이언트 자격 증명 흐름 | study/13 99 §F · 10 | placed |
| sec-assertion-grant | JWT 어서션 그랜트 | study/13 99 §F · 10 | placed |
| sec-device-authorization-flow | 기기 인가 흐름 | study/13 99 §F · 10 | placed |
| sec-implicit-flow | 암묵적 흐름 (폐기) | study/13 99 §F · 10 | placed |
| sec-ropc-flow | 비밀번호 자격 증명 흐름 (폐기) | study/13 99 §F · 10 | placed |
| sec-par | PAR · JAR | study/13 99 §F · 10 | placed |
| sec-oidc | OpenID Connect | study/13 99 §F · 11 | placed |
| sec-oidc-discovery | OIDC 디스커버리 · JWKS | study/13 99 §F · 11 | placed |
| sec-federated-logout | 연합 로그아웃 | study/13 99 §F · 11 | placed |
| sec-saml | SAML 2.0 | study/13 99 §H · 12 | placed |
| sec-sso | SSO | study/13 99 §H · 12 | placed |
| sec-single-login-origin | 단일 로그인 출처 | 기존 파일(운영 행) | placed |
| sec-scim | SCIM 프로비저닝 | study/13 99 §H · 12 | placed |
| spring-security | Spring Security | 기존 파일(운영 행) | placed |
| sec-phishing | 피싱 | 분야 표준 | placed |
| sec-xml-signature-wrapping | XML 서명 래핑 | study/13 99 §H · 12 | placed |
| sec-code-interception | 인가 코드 가로채기 | study/13 99 §F · 10 | placed |
| sec-session-token | 세션 · 토큰 관리 | 구조 노드 | placed |
| sec-server-session | 서버 세션 | study/13 99 §F · 09 | placed |
| jwt | JWT | 기존 파일(운영 행) | placed |
| sec-jws | JWS | study/13 99 §E · 08 · 22 | placed |
| sec-jwe | JWE | study/13 99 §E · 08 · 22 | placed |
| sec-jwt-validation | JWT 검증 규칙 | study/13 99 §E · 08 · 22 | placed |
| sec-jwks | JWKS · kid 키 게시 | study/13 99 §E · 08 · 22 | placed |
| sec-opaque-token | 불투명 토큰 · 인트로스펙션 | study/13 99 §F · 09 | placed |
| sec-paseto | PASETO | study/13 99 §E · 08 · 22 | placed |
| sec-macaroon | Macaroon | study/13 99 §E · 08 · 22 | placed |
| sec-refresh-token-rotation | 리프레시 토큰 회전 | study/13 99 §E · 08 · 22 | placed |
| sec-token-revocation | 토큰 폐기 | 기존 파일(운영 행) | placed |
| sec-sender-constrained-token | 송신자 제약 토큰 | study/13 99 §F · 22 | placed |
| sec-session-expiry | 세션 만료 정책 | study/13 99 §F · 09 | placed |
| sec-domain-cookie | 도메인 쿠키 세션 공유 | 기존 파일(운영 행) | placed |
| sec-token-theft | 토큰 탈취 | study/13 99 §E · 08 · 22 | placed |
| sec-jwt-algorithm-confusion | JWT 알고리즘 혼동 | study/13 99 §E · 08 · 22 | placed |
| sec-session-fixation | 세션 고정 | 분야 표준 | placed |
| sec-authorization | 인가 | 기존 파일(운영 행) | placed |
| rbac | RBAC | 기존 파일(운영 행) | placed |
| sec-abac | ABAC | study/13 99 §G | placed |
| sec-rebac | ReBAC | study/13 99 §G | placed |
| sec-policy-engine | 정책 엔진 | study/13 99 §G | placed |
| sec-object-level-authorization | 객체 수준 인가 | 코드(seller · order · promotion) | placed |
| sec-least-privilege | 최소 권한 | 분야 표준 | placed |
| sec-identity-header-stripping | 신원 헤더 제거 | 기존 파일(운영 행) | placed |
| sec-broken-access-control | 접근 제어 실패 | 분야 표준 | placed |
| sec-idor | IDOR | 분야 표준 | placed |
| sec-privilege-escalation | 권한 상승 | 분야 표준 | placed |
| sec-identity-spoofing | 신원 위조 | 기존 파일(운영 행) | placed |
| sec-service-authentication | 서비스 간 인증 | 구조 노드 | placed |
| sec-workload-identity | 워크로드 신원 | 분야 표준 | placed |
| sec-api-key | API 키 | 분야 표준 | placed |
| sec-webhook-verification | 웹훅 발신자 검증 | 코드(ads · payment) | placed |
| sec-origin-bypass | 오리진 우회 | ADR-0061 | placed |
| sec-application-defense | 애플리케이션 방어 | 구조 노드 | placed |
| sec-web-attack-defense | 입력 · 출력 방어 | 기존 파일(운영 행) | placed |
| sec-input-validation | 입력 검증 | 코드(ads · payment) | placed |
| sec-parameter-binding | 파라미터 바인딩 | 기존 파일(운영 행) | placed |
| sec-output-encoding | 출력 인코딩 | 분야 표준 | placed |
| sec-output-sanitization | 출력 정화 | 기존 파일(운영 행) | placed |
| sec-csrf-token | CSRF 토큰 | 분야 표준 | placed |
| sec-redirect-allowlist | 리다이렉트 허용 목록 | 기존 파일(운영 행) | placed |
| sec-ssrf-defense | SSRF 방어 | 분야 표준 | placed |
| sec-safe-deserialization | 안전한 역직렬화 | 분야 표준 | placed |
| sql-injection | SQL 인젝션 | 기존 파일(운영 행) | placed |
| sec-command-injection | 명령어 인젝션 | 분야 표준 | placed |
| xss | XSS | 기존 파일(운영 행) | placed |
| csrf | CSRF | 기존 파일(운영 행) | placed |
| sec-open-redirect | 오픈 리다이렉트 | 기존 파일(운영 행) | placed |
| sec-ssrf | SSRF | 분야 표준 | placed |
| sec-insecure-deserialization | 안전하지 않은 역직렬화 | 분야 표준 | placed |
| sec-path-traversal | 경로 조작 | 분야 표준 | placed |
| sec-xxe | XXE | 분야 표준 | placed |
| sec-mass-assignment | 과다 바인딩 | 분야 표준 | placed |
| sec-request-smuggling | HTTP 요청 밀반입 | 분야 표준 | placed |
| sec-browser-security | 브라우저 보안 정책 | 구조 노드 | placed |
| cors | CORS | 기존 파일(운영 행) | placed |
| sec-samesite-cookie | SameSite 쿠키 | 기존 파일(운영 행) | placed |
| sec-httponly-cookie | HttpOnly 쿠키 | 분야 표준 | placed |
| sec-secure-cookie | Secure 쿠키 | 코드(portal-fe) | placed |
| sec-csp | CSP | 코드(portal-fe) | placed |
| sec-security-headers | 보안 응답 헤더 | 코드(ads · payment) | placed |
| sec-subresource-integrity | 하위 리소스 무결성 | 분야 표준 | placed |
| sec-clickjacking | 클릭재킹 | 분야 표준 | placed |
| sec-cors-misconfiguration | CORS 설정 오류 | 분야 표준 | placed |
| sec-abuse-control | 남용 제어 | 기존 파일(운영 행) | placed |
| rate-limiting | 레이트 리미팅 | 기존 파일(운영 행) | placed |
| sec-token-bucket | 토큰 버킷 | 기존 파일(운영 행) | placed |
| sec-leaky-bucket | 리키 버킷 | 분야 표준 | placed |
| sec-fixed-window-counter | 고정 창 카운터 | 분야 표준 | placed |
| sec-sliding-window | 슬라이딩 창 | 분야 표준 | placed |
| sec-trusted-client-ip | 신뢰 프록시의 클라이언트 IP | 코드(gateway · common) | placed |
| sec-account-lockout | 로그인 시도 제한 | 코드(quant 보안) | placed |
| sec-bot-detection | 봇 식별 | 코드(gateway · common) | placed |
| sec-captcha | CAPTCHA · 챌린지 | 분야 표준 | placed |
| sec-credential-stuffing | 크리덴셜 스터핑 | 분야 표준 | placed |
| sec-scraping | 스크래핑 · 자동화 남용 | 분야 표준 | placed |
| sec-client-ip-spoofing | 클라이언트 IP 헤더 위조 | 분야 표준 | placed |
| sec-rejected-rate | 거절 비율(429) | 기존 파일(운영 행) | placed |
| sec-login-failure-rate | 로그인 실패율 | 분야 표준 | placed |
| sec-security-operations | 보안 운영 · 개인정보 | 구조 노드 | placed |
| sec-privacy | 개인정보 보호 | 구조 노드 | placed |
| sec-data-minimization | 수집 최소화 | ADR-0078 | placed |
| sec-pseudonymization | 가명처리 | ADR-0078 | placed |
| sec-tokenization | 토큰화 | study/13 99 §I · 13 · 15 | placed |
| sec-data-masking | 마스킹 | 코드(quant 보안) | placed |
| sec-field-level-encryption | 필드 단위 암호화 | 코드(seller · order · promotion) | placed |
| sec-format-preserving-encryption | 형식 보존 암호화 | study/13 99 §I · 13 · 15 | placed |
| sec-data-retention | 보존 기간 · 파기 | ADR-0077 | placed |
| sec-pii-leak | 개인정보 유출 | 분야 표준 | placed |
| sec-audit | 감사 · 탐지 | 구조 노드 | placed |
| sec-audit-logging | 감사 로그 | 코드(quant 보안) | placed |
| sec-tamper-evident-log | 변조 탐지 로그 | 코드(quant 보안) | placed |
| sec-security-monitoring | 보안 이벤트 탐지 | 분야 표준 | placed |
| sec-incident-response | 보안 사고 대응 | 분야 표준 | placed |
| sec-repudiation | 부인 | 분야 표준 | placed |
| sec-time-to-detect | 탐지까지 걸린 시간 | 분야 표준 | placed |
| sec-secure-development | 보안 설계 · 검증 | 구조 노드 | placed |
| sec-threat-modeling | 위협 모델링 | 분야 표준 | placed |
| sec-defense-in-depth | 심층 방어 | 분야 표준 | placed |
| sec-attack-surface-reduction | 노출면 축소 | ADR-0061 | placed |
| sec-sast | 정적 보안 분석 | 분야 표준 | placed |
| sec-dast | 동적 보안 분석 | 분야 표준 | placed |
| sec-dependency-scanning | 의존성 취약점 스캔 | 분야 표준 | placed |
| sec-penetration-testing | 모의 해킹 | 분야 표준 | placed |
| sec-vulnerability-disclosure | 취약점 제보 창구 | ADR-0061 | placed |
| sec-security-misconfiguration | 보안 설정 오류 | ADR-0061 | placed |
| sec-vulnerable-dependency | 취약한 의존성 | 분야 표준 | placed |
| sec-supply-chain-attack | 공급망 공격 | 분야 표준 | placed |
| jjwt | JJWT | 코드(gateway · common) | placed |
| dompurify | DOMPurify | 코드(portal-fe) | placed |
| security-glossary | 보안 용어 사전 | 기존 파일(운영 행) | placed |
| sec-glossary-crypto | 암호 용어 | 구조 노드 | placed |
| sec-term-secret-key | 비밀 키 | 기존 파일(운영 행) | placed |
| sec-term-public-private-key | 공개키 · 개인키 | study/13 01 | placed |
| sec-term-plaintext-ciphertext | 평문 · 암호문 | study/13 01 | placed |
| sec-term-iv-nonce | IV · 논스 | study/13 99 §A · 02 · 03 | placed |
| sec-term-authentication-tag | 인증 태그 | study/13 99 §A · 02 · 03 | placed |
| sec-term-associated-data | 연관 데이터(AAD) | study/13 99 §A · 21 | placed |
| sec-term-dek-kek | DEK · KEK | study/13 99 §I · 13 · 15 | placed |
| sec-term-key-id | 키 id | study/13 99 §E · 08 · 22 | placed |
| sec-term-collision-resistance | 충돌 저항성 | study/13 99 §B · 04 | placed |
| sec-term-rainbow-table | 레인보우 테이블 | study/13 99 §B · 05 | placed |
| sec-term-work-factor | 작업 계수 | study/13 99 §B · 05 | placed |
| sec-term-forward-secrecy | 전방 비밀성 | study/13 16 | placed |
| sec-term-kerckhoffs-principle | 케르크호프스 원칙 | 분야 표준 | placed |
| sec-term-spn | 치환-순열 네트워크 | study/13 99 §A · 02 · 03 | placed |
| sec-glossary-identity | 신원 · 토큰 용어 | 구조 노드 | placed |
| sec-term-access-token | 액세스 토큰 | 기존 파일(운영 행) | placed |
| sec-term-refresh-token | 리프레시 토큰 | 기존 파일(운영 행) | placed |
| sec-term-id-token | ID 토큰 | study/13 99 §F · 11 | placed |
| sec-term-bearer-token | Bearer 토큰 | 분야 표준 | placed |
| sec-term-claim | 클레임 | 기존 파일(운영 행) | placed |
| sec-term-jti | 토큰 id(jti) | study/13 99 §E · 08 · 22 | placed |
| sec-term-scope | 스코프 | study/13 99 §F · 11 | placed |
| sec-term-authorization-code | 인가 코드 | 기존 파일(운영 행) | placed |
| sec-term-redirect-uri | redirect_uri | study/13 99 §F · 10 | placed |
| sec-term-state-nonce | state · nonce | study/13 99 §F · 11 | placed |
| sec-term-oauth-roles | OAuth 역할 | study/13 99 §F · 10 | placed |
| sec-term-idp-sp | IdP · SP · RP | study/13 99 §H · 12 | placed |
| sec-glossary-web | 웹 보안 용어 | 구조 노드 | placed |
| sec-term-same-origin-policy | 동일 출처 정책 | 기존 파일(운영 행) | placed |
| sec-term-origin-vs-site | 출처 · 사이트 | 분야 표준 | placed |
| sec-term-preflight | 프리플라이트 | 분야 표준 | placed |
| sec-term-owasp-top-10 | OWASP Top 10 | 분야 표준 | placed |
| sec-glossary-governance | 보안 운영 용어 | 구조 노드 | placed |
| sec-term-pii | 개인 식별 정보 | ADR-0078 | placed |
| sec-term-cve-cvss | CVE · CVSS | 분야 표준 | placed |
| sec-term-cia-triad | 기밀성 · 무결성 · 가용성 | 분야 표준 | placed |
| ssl-tls | TLS 핸드셰이크 · 암호 스위트 | study/13 99 §D · 16 | excluded — owned by network |
| net-zero-rtt-replay | TLS 1.3 0-RTT 재전송 | study/13 99 §D · 22 | excluded — owned by network |
| net-tls-session-resumption | TLS 세션 재개(PSK) | study/13 99 §D | excluded — owned by network |
| net-mtls | mTLS | study/13 17 · 23 · ADR-0061 | excluded — owned by network — 서비스 간 인증 STAGE 가 USES 로 잇는다 |
| net-pki | PKI · 인증서 체인 | study/13 16 · 23 | excluded — owned by network — 공개키 암호 STAGE 가 USES 로 잇는다 |
| net-cert-revocation | CRL · OCSP · 스테이플링 | study/13 99 §D · 23 | excluded — owned by network |
| net-certificate-transparency | Certificate Transparency | study/13 99 §D · 23 | excluded — owned by network |
| net-hsts | HSTS | 분야 표준(OWASP 보안 헤더) | excluded — owned by network — 브라우저 보안 STAGE 가 USES 로 잇는다 |
| net-term-x509-certificate | X.509 인증서 | study/13 16 | excluded — owned by network |
| cloud-waf | WAF | ADR-0061 · 분야 표준 | excluded — owned by cloud — 남용 제어 STAGE 가 USES 로 잇는다 |
| cloud-ddos-protection | DDoS 완화 | ADR-0061 | excluded — owned by cloud — 남용 제어 STAGE 가 USES 로 잇는다 |
| cloud-ddos-attack | 서비스 거부 공격 | 분야 표준 | excluded — owned by cloud |
| cloud-zero-trust-access | 제로 트러스트 접근 | ADR-0061(Argo CD Zero Trust) | excluded — owned by cloud — 서비스 간 인증 STAGE 가 USES 로 잇는다 |
| cloud-security-group | 보안 그룹 · 네트워크 격리 | 분야 표준 | excluded — owned by cloud |
| infra-supply-chain-security | 공급망 보안(SBOM · 서명 · 스캔) | 분야 표준(SLSA) | excluded — owned by infrastructure — 보안 설계 STAGE 가 USES 로 잇는다 |
| infra-secret-leak | 시크릿 유출 | study/13 15 | excluded — owned by infrastructure — sec-secrets-management · sec-sast 가 MITIGATES 로 잇는다 |
| infra-k8s-secret | K8s Secret 과 그 한계 | study/13 15 | excluded — owned by infrastructure |
| infra-network-policy | NetworkPolicy | ADR-0061 · ADR-0031 | excluded — owned by infrastructure |
| service-mesh | 메시 자동 mTLS(Istio · Linkerd) | study/13 23 | excluded — owned by distributed — sec-workload-identity 가 USES 로 잇는다 |
| sec-aes-ni | AES-NI 하드웨어 가속 | study/13 99 §1-A | excluded — CPU 명령어 확장이라 보안 개념이 아니다 — AES-GCM 설명에 속도 근거로만 적는다 |
| sec-aws-kms-auto-rotation | AWS KMS 연 1회 자동 교체 | study/13 99 §I | excluded — 벤더 한정 설정값 — 개념은 sec-key-rotation |
| sec-kms-multi-region-keys | AWS KMS 다중 리전 키 | study/13 99 §I · 13 | excluded — 벤더 한정 기능 |
| sec-kms-grants | AWS KMS Grants · 키 정책 | study/13 13 | excluded — 벤더 한정 권한 모델 |

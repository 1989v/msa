---
parent: 13-crypto-jwt-sso
seq: 20
title: 면접 Q&A 카드 + 50문항 인덱스 + 자가 평가
type: deep
created: 2026-04-28
---

# 20. 면접 Q&A 카드 + 인덱스

> 이 파일은 회독용. 학습 종료 후 1주일 간격으로 2-3회 회독 권장.

---

## Phase 1: 암호 빌딩 블록 (8개)

**Q1.1** AES (Advanced Encryption Standard, 고급 암호화 표준)-GCM vs CBC, 왜 GCM을 쓰는가?
> CBC는 무결성을 제공하지 않아서 padding oracle attack에 취약하고, MAC을 별도로 붙여야 함. GCM은 CTR 모드로 병렬화 가능하고 GMAC으로 인증 태그까지 포함된 AEAD라 단일 호출로 기밀성+무결성을 보장. 표준이 GCM으로 굳어진 이유.

**Q1.2** IV는 비밀이어야 하는가? 왜 한 번만 써야 하는가?
> 비밀일 필요 없음 — ciphertext 앞에 평문으로 붙여 보내는 게 일반적. 다만 GCM/CTR에서 (key, IV) 쌍을 재사용하면 두 ciphertext의 XOR이 두 평문의 XOR이 되어 키스트림이 상쇄되고, GCM은 거기에 더해 인증 키까지 복원 가능해 위조까지 허용된다. 그래서 nonce는 항상 새로 생성해야 한다.

**Q1.3** ECB 모드는 왜 절대 쓰면 안 되는가?
> 같은 평문 블록이 같은 암호문 블록이 되므로 패턴이 그대로 노출된다. ECB로 암호화한 펭귄 이미지에서 펭귄 윤곽이 보이는 게 유명한 시각적 증거. 무결성도 없고 IV도 없다.

**Q1.4** 비밀번호 해싱에 SHA-256을 쓰면 안 되는 이유는?
> SHA-256은 빠르도록 설계됐는데, 비밀번호 해싱은 정반대로 느려야 한다. 빠르면 GPU로 초당 수십억 번 브루트포스가 가능해진다. 또 salt 없이 쓰면 rainbow table에 그대로 노출된다. PBKDF2/bcrypt/scrypt/argon2 같은 의도적으로 느린 KDF를 써야 하고, 현재 권장은 argon2id.

**Q1.5** bcrypt와 argon2 중 무엇을 쓰는가? 왜?
> 새 시스템은 argon2id를 쓴다. argon2는 메모리-하드 함수라 ASIC/GPU 공격을 비싸게 만들고, work factor를 메모리·시간·병렬도로 세 축에서 조절할 수 있다. bcrypt는 무난하지만 메모리 사용량이 적어 GPU 공격에 상대적으로 약하고, 입력이 72바이트에서 잘리는 한계가 있다. 다만 레거시 호환이 필요한 곳에선 bcrypt 유지.

**Q1.6** Length extension attack이 무엇이고 어떻게 막는가?
> Merkle-Damgård 구조 해시(SHA-2)에서 `H(K || M)` 형태의 MAC은 공격자가 K를 몰라도 `H(K || M || padding || M')`을 계산할 수 있다. 마지막 내부 상태가 곧 출력값이라 그걸 새로운 IV로 써서 압축을 이어갈 수 있기 때문. 방어는 HMAC 구조(이중 해시), 또는 SHA-3/BLAKE2 같은 sponge 기반 해시 사용, 또는 SHA-512/256처럼 truncated 변형 사용.

**Q1.7** RSA에서 raw 모드를 쓰면 안 되고 OAEP/PSS를 써야 하는 이유?
> Raw RSA는 결정론적이라 같은 평문이 같은 암호문이 되고, Bleichenbacher 공격(PKCS#1 v1.5 encryption) 같은 padding oracle 공격에 취약하다. OAEP는 무작위 패딩으로 IND-CCA2를 보장, PSS는 서명에 무작위 salt를 넣어 결정론성을 깨뜨린다. 현대 시스템은 암호화 OAEP, 서명 PSS가 기본.

**Q1.8** 디지털 서명에 왜 Ed25519를 선호하는 추세인가?
> ECDSA는 nonce(k) 재사용 시 개인키가 즉시 복원되는 위험이 있는데(PS3 해킹, Bitcoin 사고 사례), Ed25519는 결정론적 nonce를 써서 그 위험을 원천 차단한다. 또 키/서명 크기가 작고(64B), 부수 채널에 강하며 검증 속도가 매우 빠르다. SSH, Git, TLS 1.3 모두 채택 중.

---

## Phase 2: JWT (8개)

**Q2.1** JWT vs Session, stateless의 진짜 비용은?
> 서명만 검증해서 stateless이지만, 즉시 무효화가 어렵다. 만료 전 토큰은 살아있어서 lost device, password change 같은 시나리오에서 위험하다. 짧은 TTL + Refresh Token, 또는 Redis blacklist, token versioning으로 보완한다. 우리는 gateway에서 Redis blacklist를 fail-open으로 걸어 즉시 무효화를 지원하고 있다.

**Q2.2** Refresh Token이 탈취되면 어떻게 막는가?
> Refresh Rotation으로 막는다. 매 재발급마다 새 jti를 발급하고 이전 토큰은 무효화. 같은 Refresh가 두 번 들어오면 reuse detection으로 판단해 해당 사용자의 모든 세션을 강제 종료한다. 정상 사용자는 한 토큰만 갖고 있어야 하니까.

**Q2.3** `alg: none` 취약점이 무엇인가?
> 일부 JWT 라이브러리가 헤더의 alg가 none이면 서명 검증을 건너뛰는 버그가 있었다. 공격자가 alg를 none으로 바꾸고 서명을 비우면 통과. 현대 라이브러리는 기본 거부지만, 검증 시 허용 알고리즘 화이트리스트를 명시하는 게 정공법이다. JJWT 0.12+의 `parser().verifyWith(key)`가 그 패턴.

**Q2.4** HS256과 RS256, 언제 어느 쪽을 쓰는가?
> 발급자=검증자가 같으면 HS256 (마이크로서비스 내부, 모놀리스). 외부 IdP가 발급하고 여러 서비스가 검증해야 하면 RS256 — 공개키만 배포하면 되니까 키 관리가 단순하다. 우리는 Gateway가 발급도 검증도 하니 HS256.

**Q2.5** JWT는 어디에 저장하는 게 안전한가?
> Access Token은 메모리, Refresh Token은 httpOnly+Secure+SameSite 쿠키가 정석. localStorage는 XSS에 취약하고, httpOnly 쿠키는 JS가 읽을 수 없어 XSS에서 안전하지만 CSRF는 SameSite와 CSRF 토큰으로 보강해야 한다. 모바일 앱이라면 KeyChain/Keystore.

**Q2.6** JWT Payload에 비밀번호를 넣어도 되나?
> 절대 안 된다. JWT는 **서명만 되어 있고 암호화는 안 된다**. Base64 디코드만 하면 누구나 읽는다. 비밀 정보가 필요하면 JWE를 쓰거나, 더 흔하게는 토큰엔 식별자만 넣고 민감 정보는 서버 lookup.

**Q2.7** Access Token의 만료를 30분으로 잡았는데 더 짧게 하면?
> 짧을수록 탈취 시 피해가 줄지만, 재발급 트래픽이 증가하고 Refresh 연산 부담이 커진다. 일반적으론 5~30분이 합리적. 우리는 30분으로 두고, 무효화 시나리오는 Redis blacklist로 보강했다.

**Q2.8** Gateway가 `X-User-Id` 헤더를 주입하는데 이걸 다운스트림이 신뢰해도 되나?
> Gateway가 유일한 진입점이라는 전제 하에서만 신뢰 가능. 서비스가 외부에 직접 노출되면 헤더 위조 공격을 그대로 받는다. 네트워크 정책(K8s NetworkPolicy)으로 외부 트래픽이 Gateway를 거치도록 강제하거나, 서비스 메시 mTLS로 Gateway만 인증하게 해야 한다.

---

## Phase 3: SSO (8개)

**Q3.1** OAuth 2.0과 OIDC의 차이는?
> OAuth 2.0은 인가(Authorization) 프로토콜이라 "이 클라이언트가 이 사용자의 자원에 접근할 권한이 있다"가 본질이지 사용자 신원 자체는 표준화하지 않는다. OIDC는 그 위에 인증 레이어를 얹어 id_token(JWT)으로 사용자 신원을 표준화했다. 사용자 로그인이 필요하면 OIDC를 쓴다.

**Q3.2** Authorization Code Flow에서 PKCE가 왜 필요한가?
> 모바일/SPA는 client_secret을 안전히 저장 못 한다. Authorization Code가 모바일 OS의 redirect URL handler에서 가로채지면 코드만으로 토큰 교환이 가능했다. PKCE는 클라이언트가 code_verifier를 만들고 그 해시를 challenge로 보내, 토큰 교환 시 verifier 원본을 첨부해 증명한다. 코드만 가로채도 verifier가 없으면 실패. 현재는 confidential 클라이언트도 PKCE 적용이 권장(RFC 9700).

**Q3.3** Implicit Flow는 왜 deprecated 됐는가?
> 토큰을 URL 프래그먼트로 직접 반환해서 브라우저 히스토리, 리퍼러, 확장 프로그램에 노출된다. PKCE 적용 Authorization Code Flow가 모든 면에서 우월해서 OAuth 2.1과 RFC 9700에서 명시적으로 권장하지 않는다.

**Q3.4** SAML과 OIDC, 언제 SAML을 쓰는가?
> 신규 시스템은 OIDC가 기본. SAML은 기존 엔터프라이즈 IdP(ADFS, Shibboleth)나 정부/학술 인증 연합처럼 SAML이 이미 자리잡은 환경에서만 호환 목적으로 유지한다. XML/POST 기반이라 모바일/API에 어색하다.

**Q3.5** SAML XML Signature Wrapping Attack은 무엇인가?
> 공격자가 IdP 서명된 Assertion을 그대로 두고, 그 주변/내부에 자기 Assertion을 끼워넣어 검증기가 서명은 원본을, 실제 데이터는 공격자 것을 처리하게 만드는 공격. 방어는 ID 기반 참조로 서명된 요소를 확정한 뒤에만 사용하고, exclusive C14N과 schema validation을 강화하는 것.

**Q3.6** id_token과 access_token을 바꿔 써도 되는가?
> 안 된다. id_token은 클라이언트가 사용자 신원을 확인하는 용도, access_token은 Resource Server가 권한을 결정하는 용도다. 다른 audience(aud)를 갖고 검증 주체가 다르다. id_token으로 API 호출하거나 access_token으로 사용자 정보를 추론하면 audience binding이 깨진다.

**Q3.7** Single Logout이 왜 어려운가?
> 한 번 로그인으로 N개 SP에 세션이 생기는데, 한 번에 끊으려면 IdP가 모든 SP의 세션을 끊도록 통지해야 한다. Front-channel(브라우저 리다이렉트/iframe)은 SP가 응답 못 하면 깨지고, Back-channel(서버 간)은 endpoint 노출과 토큰 검증이 추가된다. 현실에선 IdP만 로그아웃하고 SP는 만료까지 유지하는 타협이 일반적.

**Q3.8** Authorization Code Flow에서 `state` 파라미터의 역할은?
> CSRF 방어. 클라이언트가 인증 시작할 때 랜덤 state를 만들어 세션에 저장하고 /authorize에 함께 보낸다. 콜백으로 돌아온 state가 저장된 값과 일치하지 않으면 거부. 공격자가 자기 인증 코드를 피해자 브라우저에 강제로 받게 하는 공격(login CSRF)을 막는다.

---

## Phase 4: KMS / HSM (8개)

**Q4.1** Envelope Encryption이 왜 필요한가? KMS로 직접 암호화하면 안 되나?
> KMS 직접 암호화는 4KB 제한 + API 호출당 비용 + 네트워크 왕복 비용이 있다. 큰 데이터를 위해 데이터 키(DEK)를 KMS로 감싸고, 실제 암호화는 로컬 AES로 한다. 마스터 키(KEK)는 절대 KMS 밖으로 안 나오면서도 처리량은 GB/s 수준이 된다. KMS 호출은 DEK 1개당 1번, DEK는 짧게 캐싱하면 추가 절감.

**Q4.2** Key rotation을 했는데 기존 데이터는 어떻게 복호화하는가?
> AWS KMS의 자동 rotation은 같은 KMS Key 안에서 backing key만 추가하는 방식이라 사용자 코드 변경 불필요. 키 ID는 그대로고 KMS가 메타데이터로 어떤 backing key를 썼는지 알아 복호화 라우팅한다. Manual rotation으로 키를 통째로 교체했다면 ciphertext 메타데이터에 옛 키 ID가 남아 있어 옛 키로 복호화 가능. 데이터를 새 키로 모두 옮기려면 ReEncrypt API.

**Q4.3** HSM과 KMS의 차이, 언제 HSM을 써야 하나?
> KMS도 내부적으로 HSM 위에서 도는 멀티 테넌트 서비스. CloudHSM은 단일 테넌트 + FIPS 140-2 Level 3 + PKCS#11 직접 접근. 일반적으론 KMS로 충분하고, PCI HSM, EU sovereign cloud, 자체 PKI 운영 같은 강한 컴플라이언스 요구가 있을 때 HSM을 추가한다. KMS Custom Key Store로 KMS 인터페이스에 CloudHSM을 백엔드로 붙이는 절충안도 있다.

**Q4.4** IAM Policy와 Key Policy가 이중으로 있는 이유는?
> Resource(키) 측에서 명시적으로 허용해야 안전한 lock-out 방지가 가능하기 때문. IAM만으로 KMS 키를 제어하면 IAM 권한이 잘못 부여될 때 키 통제권을 잃는다. Key Policy가 항상 우선 적용되고, IAM 위임을 명시할 때만 IAM Policy가 보조한다. 보안 측면에서 키를 만든 사람이 명시적으로 키 사용자를 지정하는 모델.

**Q4.5** GCP EKM이나 Vault Transit이 필요한 시나리오는?
> 클라우드 종속성을 줄이거나 데이터 주권(data sovereignty) 요구가 있을 때. EKM은 GCP 외부에 키를 두고 GCP 서비스가 그 키로 암복호화하게 한다. Vault Transit은 멀티 클라우드/하이브리드 환경에서 KMS를 추상화. EU GDPR, 금융 규제, 정부 클라우드 등에서 외부 KMS 요구 사례.

**Q4.6** K8s Secret만으론 왜 부족한가?
> 기본 K8s Secret은 base64 인코딩만 하고 etcd에 저장. RBAC + EncryptionConfiguration이 없으면 노드/etcd 접근 가진 사람이 그대로 읽는다. 또 회전 자동화나 감사가 약하다. External Secrets Operator + AWS Secrets Manager / Vault로 외부 store에 두고 Pod 시작 시 동기화하는 패턴이 일반적.

**Q4.7** KMS Grants는 IAM/Key Policy와 어떻게 다른가?
> 임시 위임형 권한. 예를 들어 Lambda 함수가 한 시간 동안 특정 키로 Decrypt만 하도록 grant를 발급하면, IAM/Key Policy를 건드리지 않고 동적으로 권한 부여 가능. RetireGrant로 즉시 해지. 단명 워크로드, 사용자 동의 기반 임시 접근, 워크플로 단계별 권한 등에 쓴다.

**Q4.8** Multi-Region KMS Key가 단순 복제와 다른 점은?
> 키 ID(키 ARN의 키 부분)가 모든 리전에서 동일하게 유지되고, 한 리전의 키로 암호화된 ciphertext를 다른 리전의 replica로 복호화 가능. 단순 복사면 ID가 달라 ciphertext 호환이 안 된다. DR 시나리오에서 ciphertext를 그대로 다른 리전으로 옮겨도 작동.

---

## Phase 5: TLS / mTLS / 코드 (8개)

**Q5.1** TLS 1.2와 1.3의 가장 큰 차이는?
> 1-RTT 핸드셰이크와 강제된 Forward Secrecy. 1.2는 RSA 키 교환을 허용해 서버 키가 유출되면 과거 트래픽까지 풀렸다. 1.3은 ECDHE만 허용해 매 연결 임시 키를 쓰고, RSA 키 교환을 빼서 PFS가 자연스럽게 보장된다. CBC/RC4도 제거되어 AEAD만 남았다. ServerHello 이후 모두 암호화돼서 인증서까지 평문 노출되지 않는다.

**Q5.2** TLS 1.3 0-RTT는 왜 위험한가?
> 클라이언트가 핸드셰이크와 동시에 application data를 보낼 수 있어 빠르지만, 그 데이터는 forward secrecy가 없는 이전 PSK로 보호된다. 더 큰 문제는 replay — 공격자가 0-RTT 데이터를 가로채 재전송하면 같은 요청이 두 번 실행될 수 있다. 그래서 0-RTT는 idempotent 요청에만 허용하거나 비활성하는 게 정공법.

**Q5.3** mTLS는 일반 TLS만으로 부족한 시나리오에서 왜 필요한가?
> 일반 TLS는 클라이언트가 서버를 인증하지만 서버는 클라이언트의 신원을 모른다. 서비스 메시 내부 통신, B2B API, 금융 규제(PSD2/FAPI), IoT 디바이스 인증처럼 클라이언트 신원이 중요하면 mTLS로 양방향 인증을 한다. JWT 같은 토큰은 탈취 가능하지만 클라이언트 인증서는 디바이스/HSM에 묶이면 탈취가 훨씬 어렵다. 서비스 메시는 SPIFFE 기반 SVID로 mTLS를 자동화한다.

**Q5.4** Forward Secrecy(PFS)가 왜 중요한가?
> 서버 개인키가 미래에 유출되더라도 과거 통신을 복호화할 수 없게 하는 속성. RSA 키 교환은 master secret이 서버 개인키로부터 도출되어 키 유출 시 과거 트래픽까지 풀린다. ECDHE는 매 연결마다 임시 키를 쓰고 핸드셰이크 후 즉시 폐기해 과거 트래픽이 보호된다. NSA가 광범위하게 트래픽을 저장한다는 폭로 이후 PFS가 사실상 의무화됐고 TLS 1.3에서 RSA 키 교환을 제거한 이유다.

**Q5.5** OCSP Stapling이 왜 필요한가?
> 일반 OCSP는 클라이언트가 매 연결마다 CA에 인증서 상태를 묻는데, 1) CA가 사용자가 어떤 사이트 보는지 알게 되어 프라이버시 침해, 2) CA가 다운되거나 느리면 TLS 핸드셰이크가 지연된다. OCSP Stapling은 서버가 미리 OCSP 응답을 받아 TLS 핸드셰이크에 첨부해 클라이언트가 직접 CA에 안 물어도 되게 한다. 프라이버시와 성능이 같이 좋아진다.

**Q5.6** 인증서 회전은 왜 어려운가, 어떻게 운영하는가?
> 만료 직전에 서비스 다운타임 없이 새 인증서를 교체해야 하고, 클라이언트 캐싱과 CDN 갱신 타이밍을 맞춰야 한다. cert-manager가 K8s 환경에서 ACME(Let's Encrypt) 기반으로 자동 갱신하는 게 표준이고, 서비스 메시는 SPIFFE/SPIRE로 시간 단위 short-lived cert를 자동 회전한다. 만료보다 충분히 일찍(예: 30일 전) 갱신해서 grace period를 확보.

**Q5.7** 우리 msa의 `AesUtil`을 KMS 모드로 바꾸려면 어떻게 설계하는가?
> 기존 단순 AES 모드는 유지하면서 `KmsEnvelopeAesUtil`을 별도 클래스로 추가. KMS GenerateDataKey로 DEK를 받아 평문 DEK로 AES-GCM 암호화, 암호화된 DEK를 ciphertext와 함께 저장한다. 평문 DEK는 사용 후 0으로 fill해서 메모리 잔존을 막고, AAD 파라미터로 사용자 ID 같은 컨텍스트 바인딩을 추가해 cross-context 사용을 방지한다. 운영 환경에선 `aws-encryption-sdk`가 DEK 캐싱과 암호 자료 검증을 내장해 더 권장.

**Q5.8** `JwtUtil`에 키 회전을 추가하려면?
> Header에 `kid`를 박고, 서비스가 `kid → SecretKey` 맵을 들고 있게 한다. 발급 시엔 `activeKid`로 서명, 검증 시엔 토큰의 kid로 맵에서 조회. 새 키 도입은 맵에 추가만 하고 active 갱신, 옛 키는 max(refresh 만료) 이후 제거하면 자연스러운 회전이 된다. 외부 IdP로 가면 RS256 + JWKS 엔드포인트로 공개키를 자동 배포받는 구조로 전환.

---

## 종합 — 50문항 인덱스 (회독용)

| # | 영역 | 질문 | 위치 |
|---|---|---|---|
| 1 | AES | GCM vs CBC, 왜 GCM인가 | Q1.1 |
| 2 | AES | IV는 비밀이어야 하는가, 재사용 시 무엇이 깨지는가 | Q1.2 |
| 3 | AES | ECB 절대 금지 이유 | Q1.3 |
| 4 | AES | AES-256과 128, 실용적 차이 | [03-aes-internals.md](03-aes-internals.md) |
| 5 | AES | AEAD가 무엇이고 AAD는 어디 쓰나 | [02-aes-modes.md](02-aes-modes.md) |
| 6 | Hash | SHA-1/MD5는 왜 폐기됐나 | [04-hash-functions.md](04-hash-functions.md) |
| 7 | Hash | Length extension이 무엇이고 어떻게 막나 | Q1.6 |
| 8 | Hash | Merkle-Damgård vs Sponge 차이 | [04-hash-functions.md](04-hash-functions.md) |
| 9 | PW Hash | 비밀번호에 SHA-256 직접 쓰면 안 되는 이유 | Q1.4 |
| 10 | PW Hash | bcrypt vs argon2, 무엇을 선택하나 | Q1.5 |
| 11 | PW Hash | salt vs pepper | [05-password-hashing.md](05-password-hashing.md) |
| 12 | HMAC | 단순 H(K\|\|M)이 아닌 HMAC인 이유 | [06-hmac.md](06-hmac.md) |
| 13 | RSA/ECC | RSA-2048 vs ECC-256 보안 강도 | [07-asymmetric-signing.md](07-asymmetric-signing.md) |
| 14 | RSA | 왜 raw RSA가 아니고 OAEP/PSS인가 | Q1.7 |
| 15 | ECDSA | nonce 재사용 위험 (Bitcoin/PS3 사례) | Q1.8 |
| 16 | EdDSA | Ed25519 선호 이유 | Q1.8 |
| 17 | JWT | 구조 (header.payload.sig) | [08-jwt-structure.md](08-jwt-structure.md) |
| 18 | JWT | HS256 vs RS256 선택 기준 | Q2.4 |
| 19 | JWT | alg:none 취약점 | Q2.3 |
| 20 | JWT | Stateless의 진짜 비용 | Q2.1 |
| 21 | JWT | Refresh Token 탈취 방어 (Rotation) | Q2.2 |
| 22 | JWT | 어디 저장? (localStorage vs httpOnly) | Q2.5 |
| 23 | JWT | Payload에 비밀 정보를 넣어도 되나 | Q2.6 |
| 24 | JWT | kid 헤더의 역할 | [08-jwt-structure.md](08-jwt-structure.md) |
| 25 | OAuth | 인증 vs 인가, OAuth는 어느 쪽인가 | [10-oauth2.md](10-oauth2.md) |
| 26 | OAuth | Authorization Code Flow 단계 | [10-oauth2.md](10-oauth2.md) |
| 27 | OAuth | PKCE가 왜 필요한가 | Q3.2 |
| 28 | OAuth | Implicit Flow가 deprecated 된 이유 | Q3.3 |
| 29 | OAuth | state 파라미터의 역할 | Q3.8 |
| 30 | OAuth | Client Credentials는 언제 쓰나 | [10-oauth2.md](10-oauth2.md) |
| 31 | OIDC | OAuth와의 차이 | Q3.1 |
| 32 | OIDC | id_token vs access_token | Q3.6 |
| 33 | OIDC | Discovery / JWKS의 의미 | [11-oidc.md](11-oidc.md) |
| 34 | OIDC | nonce 클레임 | [11-oidc.md](11-oidc.md) |
| 35 | SAML | SP-init vs IdP-init | [12-saml.md](12-saml.md) |
| 36 | SAML | Bindings (Redirect/POST/Artifact) | [12-saml.md](12-saml.md) |
| 37 | SAML | XML Signature Wrapping 공격 | Q3.5 |
| 38 | SAML | 왜 OIDC로 대체되고 있나 | Q3.4 |
| 39 | SSO | Single Logout이 왜 어려운가 | Q3.7 |
| 40 | KMS | Envelope Encryption이 왜 필요한가 | Q4.1 |
| 41 | KMS | Key rotation 후 옛 데이터 복호화 | Q4.2 |
| 42 | KMS | IAM Policy + Key Policy 이중 모델 | Q4.4 |
| 43 | KMS | KMS Grants의 용도 | Q4.7 |
| 44 | KMS | Multi-Region Key의 의미 | Q4.8 |
| 45 | HSM | KMS와 HSM 차이, 언제 HSM | Q4.3 |
| 46 | HSM | FIPS 140-2 Level 의미 | [15-hsm.md](15-hsm.md) |
| 47 | TLS | 1.2와 1.3 차이 | Q5.1 |
| 48 | TLS | 0-RTT 위험성 | Q5.2 |
| 49 | TLS | Forward Secrecy의 중요성 | Q5.4 |
| 50 | mTLS | 왜 일반 TLS만으론 부족한가 | Q5.3 |

---

## 면접 준비도 자가 평가

| 영역 | 자가 평가 (목표 5) |
|---|---|
| AES (모드, IV, AEAD) | ☐☐☐☐☐ |
| 비밀번호 해싱 (argon2id) | ☐☐☐☐☐ |
| 해시 + length extension | ☐☐☐☐☐ |
| RSA/ECDSA/EdDSA 비교 | ☐☐☐☐☐ |
| JWT 구조 + 알고리즘 | ☐☐☐☐☐ |
| Refresh Rotation | ☐☐☐☐☐ |
| OAuth + PKCE | ☐☐☐☐☐ |
| OIDC vs OAuth | ☐☐☐☐☐ |
| SAML 흐름 + Wrapping | ☐☐☐☐☐ |
| KMS Envelope | ☐☐☐☐☐ |
| TLS 1.3 + PFS | ☐☐☐☐☐ |
| mTLS / SPIFFE | ☐☐☐☐☐ |

---

## 회독 가이드

- **1회독**: 학습 직후 — 모든 답변을 노트 보지 않고 입으로 답해보기
- **2회독**: 1주일 후 — 막힌 부분만 노트 다시 보기
- **3회독**: 면접 직전 — 50문항 인덱스만 보고 키워드만으로 답변 가능한지 확인

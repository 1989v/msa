# Seller — Domain Glossary

## 1. Bounded Context Overview

Seller BC 는 마켓플레이스 판매자의 **등록 상태와 거래 조건(수수료율·배송비·정산 주기)의 권위**다.
판매자 권한은 이 BC 의 판매자 행으로 판정하고, 다른 BC(order·product·auth)는 `seller.seller.*` 이벤트로 사본을 유지한다.

## 2. 용어

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 판매자 | 입점 신청 한 건과 그 등록 상태. 반려 후 재신청은 새 판매자 행 | `Seller` |
| 입점 신청 | 로그인 회원이 판매자가 되려고 내는 요청. PENDING 으로 시작 | `ApplySellerUseCase` |
| 판매자 상태 | PENDING · ACTIVE · REJECTED · SUSPENDED | `SellerStatus` |
| 열린 판매자 | 회원을 점유하는 상태(PENDING·ACTIVE·SUSPENDED). 회원당 하나 | `SellerStatus.occupiesMember` |
| 수수료율 | 라인 순매출에 매기는 판매 수수료. 베이시스 포인트(1bp = 0.01%), 승인 때 어드민이 정한다 | `commissionRateBp` |
| 배송비 | 판매자별 고정 배송비, 원 단위 | `shippingFee` |
| 정산 주기 | WEEKLY · MONTHLY | `SettlementCycle` |
| 정산 계좌 | 지급 받을 계좌. 암호문·키 버전·마스킹 값으로만 저장 | `EncryptedAccount` · `accountMasked` |
| 어드민 조치 | 승인·반려·정지·재활성·수수료율 변경 기록(행위자·사유) | `SellerAdminAction` |
| 플랫폼 기본 판매자 | id 1, 판매자가 없던 기존 상품의 소유자 | `seller.id = 1` |
| 개인정보 파기 | 반려 후 30일에 사업자번호·대표자·계좌를 지우는 것 | `purgePersonalData` |

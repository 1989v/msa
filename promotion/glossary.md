# Promotion — Domain Glossary

## 1. Bounded Context Overview

Promotion BC 는 **쿠폰·포인트의 권위**다. 주문서는 order 읽기 모델로 할인을 견적하고, 최종 판정은 사가의 보류(reserve)가 여기서 한다.
확정된 쿠폰·포인트는 클레임 원복으로만 되돌아온다.

## 2. 용어

| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 쿠폰 정의 | 할인 조건(정액·정률·최대 할인·최소 주문 금액·기간)과 발행 상한 | `CouponDefinition` |
| 부담 주체 | 할인을 누가 지는가. 판매자 부담 쿠폰은 그 판매자 라인에만 적용 | `CouponBearer` (PLATFORM · SELLER) |
| 사용자 쿠폰 | 회원이 받은 쿠폰 한 장. 한 번만 쓰인다 | `UserCoupon` |
| 쿠폰 받기 | 회원이 정의에서 한 장을 발급받음. 발행 상한·1인 1장 | `claim` · `ClaimCouponUseCase` |
| 대상 금액 | 쿠폰이 적용되는 라인(판매가 × 수량)의 합. 배송비 제외 | `CouponLine` · `eligibleAmount` |
| 포인트 잔액 | 회원의 현재 포인트. 0 아래로 내려가지 않는다 | `PointBalance` |
| 포인트 원장 | 잔액 변경 한 줄. 추가만, 합 = 잔액 | `PointLedgerEntry` (EARN · USE · USE_CANCEL · USE_EXPIRE · RESTORE) |
| 혜택 보류 | 주문 하나가 붙잡은 쿠폰·포인트(TCC 의 Try). 기한 30분 | `PromotionHold` |
| 보류 확정 | 결제 승인 뒤 보류를 사용으로 확정(Confirm) | `confirm` · `CONFIRMED` |
| 보류 취소 | 피벗 전 실패의 보상(Cancel) | `cancel` · `CANCELLED` |
| 보류 만료 | 기한까지 확정되지 않은 보류를 푸는 것 | `expire` · `EXPIRED` |
| 원복 | 클레임 환불 때 포인트를 되돌리고 전체 취소면 쿠폰을 돌려줌 | `restore` · `HoldRestoration` · `restoreKey` |
| 실패 사유 | `promotion.hold.failed` 의 reason — 사가가 분기하는 계약 값 | `PromotionFailureReason` |

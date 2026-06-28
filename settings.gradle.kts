rootProject.name = "commerce-platform"

include(
    "common",
    "gateway",
    "product:domain",
    "product:app",
    "order:domain",
    "order:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (inventory:app 이 흡수)
    "search:domain",
    "search:app",
    "search:consumer",
    "search:batch",
    "agent-viewer:api",
    "gifticon:domain",
    "gifticon:app",
    "auth:domain",
    "auth:app",
    "code-dictionary:domain",
    "code-dictionary:app",
    "inventory:domain",
    "inventory:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (비-bootable)
    "inventory:app",
    "fulfillment:domain",
    "fulfillment:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (inventory:app 이 흡수)
    "warehouse:domain",
    "warehouse:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (구 warehouse:app, 비-bootable)
    "chatbot:domain",
    "chatbot:app",
    "analytics:domain",
    "analytics:app",
    "experiment:domain",
    "experiment:app",
    "member:domain",
    "member:app",
    "wishlist:domain",
    "wishlist:app",
    "quant:domain",
    "quant:app",
    "recommendation:domain",
    "recommendation:app"
)

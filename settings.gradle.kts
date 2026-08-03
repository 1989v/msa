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
    "game:sim",     // #23 흡수: KMP 결정적 sim-core (jvm: Tier B 리플레이 / js: 브라우저)
    "game:web",     // #23 흡수: Kotlin/JS 브라우저 클라이언트 (game:sim js 코어 소비)
    "game:domain",
    "game:feature", // ADR-0059: 게임 플랫폼 라이브러리 (code-dictionary:app 이 흡수, 비-bootable)
    "inventory:domain",
    "inventory:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (비-bootable)
    "commerce:app",
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
    "member:feature",
    "wishlist:domain",
    "wishlist:feature",
    "quant:domain",
    "quant:app",
    "recommendation:domain",
    "recommendation:app",
    "place:domain",
    "place:app"
)

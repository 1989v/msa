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
    "member:app",
    "wishlist:domain",
    "wishlist:app",
    "quant:domain",
    "quant:app",
    "recommendation:domain",
    "recommendation:app",
    // 웹 게임 아케이드(#23, ADR-0058 commerce:app 폴드)
    "game:sim",     // KMP 결정적 sim-core (jvm: Tier B / js: 브라우저)
    "game:domain",  // 순수 백엔드 도메인 + 포트 + Tier A/B 검증 규칙
    "game:feature", // commerce:app 폴드 — Redis 전용 인프라 + 컨트롤러
    "game:web"      // Kotlin/JS 브라우저 클라이언트 — game:sim js 코어 소비
)

rootProject.name = "commerce-platform"

include(
    "common",
    "gateway",
    "product:domain",
    "product:feature",
    "order:domain",
    "order:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (commerce:app 이 흡수)
    "search:domain",
    "search:app",
    "search:consumer",
    "search:batch",
    "agent-viewer:api",
    "gifticon:domain",
    "gifticon:feature",
    "auth:domain",
    "auth:app",
    "code-dictionary:domain",
    "code-dictionary:feature",
    "game:sim",     // #23 흡수: KMP 결정적 sim-core (jvm: Tier B 리플레이 / js: 브라우저)
    "game:web",     // #23 흡수: Kotlin/JS 브라우저 클라이언트 (game:sim js 코어 소비)
    "game:domain",
    "game:feature", // ADR-0059: 게임 플랫폼 라이브러리 (code-dictionary:app 이 흡수, 비-bootable)
    "inventory:domain",
    "inventory:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (비-bootable)
    "commerce:app",
    "fulfillment:domain",
    "fulfillment:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (commerce:app 이 흡수)
    "warehouse:domain",
    "warehouse:feature", // ADR-0058: commerce 모듈러 모놀리스 라이브러리 (구 warehouse:app, 비-bootable)
    "chatbot:domain",
    "chatbot:feature",
    "analytics:domain",
    "analytics:app",
    "experiment:domain",
    "experiment:feature",
    "member:domain",
    "member:feature",
    "wishlist:domain",
    "wishlist:feature",
    "quant:domain",
    "quant:feature",
    "recommendation:domain",
    "recommendation:feature",
    // ADR-0093 — engagement: recommendation+experiment 폴드 호스트
    "engagement:app",
    // ADR-0093 — account: member+wishlist 폴드 호스트
    "account:app",
    // ADR-0093 — sideapp: quant+chatbot+gifticon 폴드 호스트 (도메인 단절 사이드앱)
    "sideapp:app",
    // ADR-0093 — content: game+place 폴드 호스트 (노출 서브도메인). ②~③에서 blog·ranking 합류
    "content:app",
    // ADR-0093 — atlas: apex 총람 (개념사전·포트폴리오·전시·이력서) 폴드 호스트
    "atlas:app",
    "place:domain",
    "place:feature", // ADR-0093: content:app 이 흡수 (비-bootable)
    "deal:domain",
    "deal:feature", // ADR-0069: 혜택 링크 허브 라이브러리 (code-dictionary:app 이 흡수, 비-bootable)
    "blog:domain",
    "blog:feature", // ADR-0072: 블로그 플랫폼 라이브러리 (code-dictionary:app 이 흡수, 비-bootable)
    "ranking:domain",
    "ranking:feature" // ADR-0081: 랭킹 리더보드 라이브러리 (code-dictionary:app 이 흡수, 비-bootable)
)

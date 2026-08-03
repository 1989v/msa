package com.kgd.game.domain.ads.model

/** 광고 유형 — 배너/영상 3종 (설계 §4.3, CrazyGames 동형) */
enum class AdType { BANNER, PREROLL, MIDGAME, REWARDED }

/** 집행 주체 — HOUSE(자체 홍보)로 시작, 외부 네트워크는 후속 (ADR-0059 §3) */
enum class AdProvider { HOUSE, ADSENSE, GAM }

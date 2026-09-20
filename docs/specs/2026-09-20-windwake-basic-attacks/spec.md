<!-- source: windwake/sim.mjs -->
<!-- source: windwake/main.mjs -->

# Basic attacks without crowd control

User-authorized balance correction,2026-09-20. RiskL3 gameplay behavior; existing same-game deployment authorization applies. No architecture/schema/dependency change or new ADR.

All ordinary attack input damage (sword combo1/2/3 and airborne plunge) preserves a surviving enemy's AI state, remaining timer, attack trajectory/velocity and poise. It must not create or refresh stagger, knockback or global simulation hit-stop. Damage, armor, range/cover/height, combo timing, particles, flash, shake, sound, energy gain and lethal rewards remain unchanged. Skills, parry and other existing crowd-control sources retain their behavior, including boss poise rules. An existing skill/parry stagger may continue but a basic hit cannot extend or shorten it.

Verify each combo, pending attacks resolving after hits, active charges, prior stagger duration, plunge, deaths/rewards and skill/parry control. Run existing domain and natural route regressions, real Chrome trusted attack/skill input plus deterministic impact checks, independent nonauthor review, then publish the same static game and verify exact public bytes and combat. Preserve all unrelated user changes and hooks.

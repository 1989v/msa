# Expanded combat contract

Root owns sim.mjs orchestration/abilities/save/streaming; combat worker owns new combat.mjs and tests/combat.test.mjs. Module imports may use world/progression, never sim/UI/render. Other agents are editing concurrently; never revert their files.

Exports:
- ENEMY_STATS keyed by12 regular IDs plus boss. Preserve old stats stalker{hp55,speed3.3,damage13}, ranger{hp44,speed2.5,damage12}, charger{hp95,speed2.5,damage22}, boss{hp740,speed2.6,damage23}. Add name/xp and behavior fields freely. ENEMY_NAMES mapping for HUD.
- updateExpandedEnemy(s,e,dt,hooks) returns true if handled; false for original stalker/ranger/charger or original boss without bossId. Handle nine added IDs and bossId regional/final bosses. Raid actors are handled by village, never here. All transient fields on e are JSON-serializable.

Hooks:
- move(e,dx,dz,radius=.5): root physical horizontal move against local terrain/static/village solids.
- ground(e,dt): root applies gravity and support; flying foes may bypass and assign altitude explicitly. Keep e.y finite and attacks vertically reachable.
- lineClear(a,b): static and village solid cover test.
- damagePlayer(amount,e,unblockable=false)→bool; preserves dodge/parry timings. Attacks must first respect cover/height.
- hitEnemy(e,amount,kind,knock=3): core damage/reward pathway for support/bomber/etc; do not bypass kill rewards or award them twice.
- shoot(e,count=1,options={}): options speed,damage,spread,kind ('bolt'|'frost'),slow seconds; root constructs bounded player-target projectiles with precise aim.
- spawn(type,x,z,extra={})→enemy|null: used for bounded boss adds, tagged summonedBy=e.id; null is handled safely. At most3 living adds per boss, no per-frame spawning.
- effect(type,e,extra), emit(type,e), toast(text), random() deterministic state RNG.

Enemy IDs: slime (hopping close-range), wolf (telegraphed leap/pack), boar (unarmored charge), shaman (visible ally heal + ranged attack), wisp (kite/hover, descends to strike/recover), bomber (long-fuse burst, interruptible), sentinel (guard/sweep, core frontal armor), burrower (visible ground tell then emerge), frostling (slow projectile). Preserve intelligible wind-up, active, recover, hit, dead states. Timer/hitFlash update for handled enemies is worker responsibility.

Regional boss fields: type='boss',bossId,family in bulwark/tempest/thorn/tide,level,final,homeX/homeZ/homeY,maxHp,hp,phase,pattern. Family-specific sequence and phase2 are real behaviors. Stay within22m of home arena, use ground support (never legacy y28/clamps). Pattern IDs are slam,ring,charge,bolt,sweep,eruption,summon,slow,leap,burst; set telegraphRadius for precise renderer. Ring can be jumped; charge direction locks before launch; support/summons and projectile fans have limits. Avoid slow boss stunlock; core handles poise. Regional UI names from e.name.

Tests independently exercise each behavior family and cover/vertical/telegraph/cap handling through hooks. Root adds integration tests against actual sim helpers after module integration. Coordinate any hook change before implementation.

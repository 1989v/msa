/** Public catalog routes only; kept in parity with the catalog fixture and source-backed guides.
 * Slugs alone let optional performance collection avoid downloading the full bilingual guides. */
export const PUBLIC_GAME_SLUGS = new Set(`duel-defense marine-command epoch-of-nations gwiyahaeng landslide arena
circle-trace seven-seconds zombie-lane zombie-march infinity-step last-one
nine-bells archer-outbreak random-card-defense infinity-tower random-tower-defense bee-guard
card-flip marble-race ladder-draw pixel-logic hoop-order sum-trail
coin-corgi aero-vendetta curfew-siren deadline ashen-warband nova-strike
raging-fist-saga abyssal-crown nether-return sketch-sleuth drift-continent moon-angler
cliff-climber relic-heir element-pilgrim hand-alchemy spud-arena midnight-tide
serpent-legion dawn-ward beat-dojo breeze-links alley-pool starlight-farm
hero-dispatch cog-foundry abyss-drill bracket-battle acid-rain rope-works
stone-sage mine-pioneer crate-shift block-burst number-garden royal-grid
pixel-mine quad-weave word-warden rift-front dice-citadel storm-corridor
crimson-ravine wall-breaker cave-glide rune-merge golden-forge echo-duel
frost-outpost ember-temple iron-vanguard gear-bastion gate-holdout outlaw-frontier
monster-tamer depth-delver overworld-quest snake`.split(/\s+/));

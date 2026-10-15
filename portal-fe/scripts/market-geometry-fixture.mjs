// Local test/manual display fixture, never shipped as a public asset.
// From portal-fe: node scripts/market-geometry-fixture.mjs > /tmp/market-p4.json
// To intercept GET /api/v1/place/markets/{contentId}, wrap the JSON as { data: fixture }.
// Synthetic IDs and IN memberships are display scaffolding, not rejudgement results.
import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../../place/domain/src/test/resources/market/gwangmyeong_osm.json', import.meta.url), 'utf8'));
const paths = source.ped.map((path, index) => ({
  id: index + 1, name: path.named ? path.label : null, named: path.named,
  geometry: path.g, source: 'OSM',
}));
const fixture = {
  market: { name: '광명시장 · 표시 검증 표본', marketType: 'STREET', sourceMarketType: null,
    storeCountRaw: null, openingCycle: null, facilities: null, attribution: null },
  zones: [],
  boundary: { polygon: source.poly, source: 'OSM', osmId: null },
  paths,
  entrances: source.ent.map((entry, index) => ({ id: index + 1, lat: entry.p[0], lng: entry.p[1],
    pathId: source.ped.findIndex((path) => path.label === entry.via) + 1 || null,
    label: `입구 ${index + 1}`, source: 'OSM' })),
  attribution: ['© OpenStreetMap contributors'],
  // Raw address/name/coordinates only. Do not consume cur/poly/snap/sd/how expectations.
  stores: source.stores.filter((store) => paths.some((path) => path.name === store.r)).slice(0, 24).map((store, index) => ({
    id: index + 1, name: store.n, items: store.i, zoneId: null,
    pathId: paths.find((path) => path.name === store.r)?.id ?? null,
    membership: 'IN', latitude: store.la, longitude: store.lo, roadAddress: store.r,
    jibunAddress: null, buildingName: null, dong: null, floor: null, ho: null,
    categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'],
    pinKind: 'EXACT', manual: false, actorKind: null, relativePosition: null, positionNote: null,
  })),
};
process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`);

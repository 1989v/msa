import TechDrillPage, { type DrillData } from './TechDrillPage';
import { drillPage } from './drillPages.mjs';
import generated from './generated/ads-drill.json';

const PAGE = drillPage('ads');

/** `/tech/ads` — 광고 드릴다운. 그리는 일은 TechDrillPage, 데이터는 도메인마다 따로 묶어 청크를 나눈다 */
export default function AdsArchitecturePage() {
  return <TechDrillPage page={PAGE} data={generated as unknown as DrillData} />;
}

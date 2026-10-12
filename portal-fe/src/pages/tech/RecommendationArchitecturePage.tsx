import TechDrillPage, { type DrillData } from './TechDrillPage';
import { drillPage } from './drillPages.mjs';
import generated from './generated/recommendation-drill.json';

const PAGE = drillPage('recommendation');

/** `/tech/recommendation` — 추천 드릴다운. 그리는 일은 TechDrillPage, 데이터는 도메인마다 따로 묶어 청크를 나눈다 */
export default function RecommendationArchitecturePage() {
  return <TechDrillPage page={PAGE} data={generated as unknown as DrillData} />;
}

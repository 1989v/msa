import TechDrillPage, { type DrillData } from './TechDrillPage';
import { drillPage } from './drillPages.mjs';
import generated from './generated/commerce-catalog-drill.json';

const PAGE = drillPage('commerce-catalog');

/** `/tech/catalog` — 상품 · 재고 드릴다운. 그리는 일은 TechDrillPage, 데이터는 도메인마다 따로 묶어 청크를 나눈다 */
export default function CatalogArchitecturePage() {
  return <TechDrillPage page={PAGE} data={generated as unknown as DrillData} />;
}

import { AreaChartCard } from '@kgd/design-system';
import type { DailyOrderStat } from '@admin/types/dashboard';

interface OrderChartProps {
  data: DailyOrderStat[];
}

/**
 * OrderChart — admin 대시보드 7일 주문 현황.
 *
 * @kgd/design-system AreaChartCard 사용 — sample 2 (포트폴리오 누적수익) 의
 * 다크 네이비 카드 + 녹색 그라디언트 area 톤을 그대로 적용.
 */
export function OrderChart({ data }: OrderChartProps) {
  return (
    <AreaChartCard
      title="7일 주문 현황"
      tone="profit"
      height={200}
      data={data.map((d) => ({ x: d.date.slice(5), y: d.orderCount }))}
      tooltipFormatter={(v) => `${v}건`}
      tooltipLabel="주문수"
      emptyMessage="데이터 없음"
    />
  );
}

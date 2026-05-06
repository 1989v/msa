/**
 * @kgd/design-system — public entry.
 *
 * 사용:
 *   // 1. tokens.css 한 번 import (보통 main.tsx)
 *   import '@kgd/design-system/tokens.css';
 *
 *   // 2. 컴포넌트 import
 *   import { KpiCard, StatCard, ListRow, SegmentControl, PrimaryButton } from '@kgd/design-system';
 */

export { KpiCard } from './components/KpiCard';
export type { KpiCardProps } from './components/KpiCard';

export { StatCard } from './components/StatCard';
export type { StatCardProps } from './components/StatCard';

export { ListRow } from './components/ListRow';
export type { ListRowProps } from './components/ListRow';

export { SegmentControl } from './components/SegmentControl';
export type { SegmentControlProps, SegmentOption } from './components/SegmentControl';

export { PrimaryButton } from './components/PrimaryButton';
export type { PrimaryButtonProps } from './components/PrimaryButton';

export { Checkbox } from './components/Checkbox';
export type { CheckboxProps } from './components/Checkbox';

export { TrancheCard } from './components/TrancheCard';
export type { TrancheCardProps } from './components/TrancheCard';

export { AreaChartCard } from './components/AreaChartCard';
export type { AreaChartCardProps, AreaPoint } from './components/AreaChartCard';

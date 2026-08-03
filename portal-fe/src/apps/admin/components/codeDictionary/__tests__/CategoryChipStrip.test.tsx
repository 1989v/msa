import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryChipStrip from '../CategoryChipStrip';
import type { ChipItem } from '../CategoryChipStrip';

/**
 * CategoryChipStrip (admin) component tests.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.5, §6.6
 * Plan: planning/test-quality.md §Component Tests + planning/tasks.md T3.7
 */

const SAMPLE_CATEGORIES: ChipItem[] = [
  { name: 'ARCHITECTURE', count: 7 },
  { name: 'DATABASE', count: 11 },
  { name: 'NETWORK', count: 4 },
];

describe('CategoryChipStrip (admin)', () => {
  it('renders one chip per category plus the "전체" chip', () => {
    render(
      <CategoryChipStrip
        categories={SAMPLE_CATEGORIES}
        selected={new Set()}
        onToggle={() => {}}
      />,
    );

    const tablist = screen.getByRole('tablist', { name: '카테고리 필터' });
    const tabs = within(tablist).getAllByRole('tab');

    expect(tabs).toHaveLength(SAMPLE_CATEGORIES.length + 1);
    expect(tabs[0]).toHaveTextContent('전체');
    expect(within(tablist).getByText('ARCHITECTURE')).toBeInTheDocument();
    expect(within(tablist).getByText('DATABASE')).toBeInTheDocument();
    expect(within(tablist).getByText('NETWORK')).toBeInTheDocument();
  });

  it('invokes onToggle with the category name when a chip is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryChipStrip
        categories={SAMPLE_CATEGORIES}
        selected={new Set()}
        onToggle={onToggle}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /DATABASE/ }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('DATABASE');
  });

  it('reflects selected state via aria-selected', () => {
    render(
      <CategoryChipStrip
        categories={SAMPLE_CATEGORIES}
        selected={new Set(['ARCHITECTURE'])}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByRole('tab', { name: /ARCHITECTURE/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /DATABASE/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: '전체' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('marks "전체" chip selected and invokes onClearAll when clicked', async () => {
    const onClearAll = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryChipStrip
        categories={SAMPLE_CATEGORIES}
        selected={new Set()}
        onToggle={() => {}}
        onClearAll={onClearAll}
      />,
    );

    const allTab = screen.getByRole('tab', { name: '전체' });
    expect(allTab).toHaveAttribute('aria-selected', 'true');

    await user.click(allTab);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

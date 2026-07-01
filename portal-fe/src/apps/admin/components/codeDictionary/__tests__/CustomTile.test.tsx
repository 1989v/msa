import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomTile from '../CustomTile';

/**
 * CustomTile (admin) tests.
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.6, §6.9
 * Plan: planning/test-quality.md §Component Tests + planning/tasks.md T3.7
 */

function renderTile(overrides: Record<string, unknown> = {}) {
  return render(
    <svg width={400} height={400}>
      <CustomTile
        x={0}
        y={0}
        width={120}
        height={80}
        depth={2}
        name="Clean Architecture"
        level="INTERMEDIATE"
        conceptId="clean-architecture"
        indexCount={12}
        {...overrides}
      />
    </svg>,
  );
}

describe('CustomTile (admin)', () => {
  it('renders a treeitem rect filled with the level token color', () => {
    const { container } = renderTile();

    const tile = screen.getByRole('treeitem');
    expect(tile).toBeInTheDocument();

    const rect = container.querySelector('g[role="treeitem"] rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('fill')).toBe('var(--ko-level-intermediate)');
  });

  it('builds aria-label with name, level (한글), indexCount', () => {
    renderTile();

    expect(screen.getByRole('treeitem')).toHaveAttribute(
      'aria-label',
      'Clean Architecture, 중급, indexCount 12',
    );
  });

  it('invokes onTileClick(conceptId) on click', async () => {
    const onTileClick = vi.fn();
    const user = userEvent.setup();
    renderTile({ onTileClick });

    await user.click(screen.getByRole('treeitem'));

    expect(onTileClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).toHaveBeenCalledWith('clean-architecture');
  });

  it('invokes onTileClick on Enter keypress', async () => {
    const onTileClick = vi.fn();
    const user = userEvent.setup();
    renderTile({ onTileClick });

    const tile = screen.getByRole('treeitem');
    tile.focus();
    await user.keyboard('{Enter}');

    expect(onTileClick).toHaveBeenCalledWith('clean-architecture');
  });
});

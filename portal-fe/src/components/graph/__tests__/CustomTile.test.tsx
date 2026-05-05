import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomTile from '../CustomTile';

/**
 * CustomTile tests — recharts injects layout props (x/y/width/height/depth)
 * via React.cloneElement, so in unit tests we render <CustomTile /> directly
 * with explicit props (depth=2 ⇒ leaf concept tile).
 *
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §6.6, §6.9
 * Plan: planning/test-quality.md §Component Tests + planning/tasks.md T2.8
 */

function renderTile(overrides: Record<string, unknown> = {}) {
  // recharts' content prop usually receives an SVG context; we wrap in <svg>
  // so DOM hierarchy matches what the browser would build.
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
        categoryKey="ARCHITECTURE"
        {...overrides}
      />
    </svg>,
  );
}

describe('CustomTile (code-dictionary)', () => {
  it('renders a treeitem rect filled with category×level OKLCH color', () => {
    const { container } = renderTile();

    const tile = screen.getByRole('treeitem');
    expect(tile).toBeInTheDocument();

    // ARCHITECTURE hue=195, INTERMEDIATE lightness=0.62, chroma=0.10
    const rect = container.querySelector('g[role="treeitem"] rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('fill')).toMatch(/^oklch\(0\.62 0\.1 195\)$/);
  });

  it('builds aria-label with name, level (한글) and indexCount', () => {
    renderTile();

    const tile = screen.getByRole('treeitem');
    expect(tile).toHaveAttribute(
      'aria-label',
      'Clean Architecture, 중급, indexCount 12',
    );
  });

  it('invokes onTileClick(conceptId) when the tile is clicked', async () => {
    const onTileClick = vi.fn();
    const user = userEvent.setup();
    renderTile({ onTileClick });

    await user.click(screen.getByRole('treeitem'));

    expect(onTileClick).toHaveBeenCalledTimes(1);
    expect(onTileClick).toHaveBeenCalledWith('clean-architecture');
  });

  it('invokes onTileClick when Enter is pressed while focused', async () => {
    const onTileClick = vi.fn();
    const user = userEvent.setup();
    renderTile({ onTileClick });

    const tile = screen.getByRole('treeitem');
    tile.focus();
    await user.keyboard('{Enter}');

    expect(onTileClick).toHaveBeenCalledWith('clean-architecture');
  });
});

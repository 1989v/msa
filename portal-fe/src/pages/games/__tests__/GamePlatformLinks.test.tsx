import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import GamePlatformLinks from '../GamePlatformLinks';
import GameCard from '../GameCard';
import { MemoryRouter } from 'react-router-dom';
import type { GameSummary } from '../../../api/gameApi';
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
afterEach(cleanup);
const link = { platform: 'ROBLOX' as const, url: 'https://www.roblox.com/games/123', releaseStatus: 'BETA' as const };
describe('external platform editions', () => {
  it('renders no empty area for old servers or games without editions', () => {
    const view = render(<GamePlatformLinks lang="ko" />);
    expect(view.container).toBeEmptyDOMElement();
    view.rerender(<GamePlatformLinks lang="en" links={[]} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it('uses an ordinary safe external anchor with localized new-tab explanation', () => {
    const view = render(<GamePlatformLinks lang="ko" links={[link]} />);
    const anchor = screen.getByRole('link', { name: /로블록스 버전/ });
    expect(anchor).toHaveAttribute('href', link.url);
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    expect(anchor).toHaveAccessibleDescription(/새 탭/);
    expect(screen.getByText('베타')).toBeInTheDocument();
    view.rerender(<GamePlatformLinks lang="en" links={[{ ...link, releaseStatus: 'RELEASED' }]} />);
    expect(screen.getByRole('link', { name: /Play the Roblox version/ })).toHaveAccessibleDescription(/Opens in a new tab/);
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });
  it('does not render an invalid destination', () => {
    const view = render(<GamePlatformLinks lang="en" links={[{ ...link, url: 'https://evil.test/' }]} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it('shows a non-interactive card badge inside the existing detail link', () => {
    const game: GameSummary = { id: 1, slug: 'alpha', title: 'Alpha', titleEn: null, thumbnailUrl: '', loadType: 'IFRAME', supportsMobile: true, status: 'PUBLISHED', genre: 'ACTION', tags: [], playCount: 0, ratingAvg: 0, ratingCount: 0, availablePlatforms: ['ROBLOX'] };
    const view = render(<MemoryRouter><GameCard game={game} lang="en" /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText(/Roblox/).tagName).toBe('SPAN');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/games/alpha');
    view.rerender(<MemoryRouter><GameCard game={{ ...game, availablePlatforms: undefined }} lang="en" /></MemoryRouter>);
    expect(screen.queryByText(/Roblox/)).not.toBeInTheDocument();
  });
});

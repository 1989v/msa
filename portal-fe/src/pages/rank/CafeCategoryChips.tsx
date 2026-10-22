import { Link } from 'react-router-dom';
import type { CafeFilters } from '../../api/rankingApi';
import { activeCafeCategory, cafeCategories, selectCafeCategory } from './cafeCategories';
import { writeCafeFilters } from './cafeUrl';

export default function CafeCategoryChips({ filters = {}, path = '/cafe/search', label = '음료 유형' }: { filters?: CafeFilters; path?: string; label?: string }) {
  const active = activeCafeCategory(filters);
  return <nav className="cafe-groups" aria-label={label}>{cafeCategories.map(category => {
    const selected = category.slug === active;
    return <Link key={category.slug} className={selected ? 'is-active' : undefined} aria-current={selected ? 'true' : undefined} to={`${path}?${writeCafeFilters(selectCafeCategory(filters, selected ? 'all' : category.slug))}`}>{category.label}</Link>;
  })}</nav>;
}

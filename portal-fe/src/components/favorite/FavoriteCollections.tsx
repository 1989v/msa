import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  createCollection,
  deleteCollection,
  moveFavorite,
  renameCollection,
  type FavoriteCollection,
  type FavoriteTargetType,
} from '../../api/wishlistApi';
import type { CollectionFilter } from './useCollections';
import './FavoriteCollections.css';

/**
 * 묶음 필터 줄 (ADR-0080) — 관광지 찜에만 붙는다.
 *
 * 게임·블로그 글을 여행 묶음에 넣을 이유가 없고, 전 타입에 열면 화면이 무거워진다.
 */
export function CollectionBar({
  collections,
  filter,
  onChange,
  lang,
}: {
  collections: FavoriteCollection[];
  filter: CollectionFilter;
  onChange: (next: CollectionFilter) => void;
  lang: 'ko' | 'en';
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['favorites'] });
  };
  const create = useMutation({
    mutationFn: (value: string) => createCollection(value),
    onSuccess: () => {
      setName('');
      setAdding(false);
      refresh();
    },
  });

  const isActive = (f: CollectionFilter) =>
    f.kind === filter.kind && (f.kind !== 'one' || (filter.kind === 'one' && f.id === filter.id));

  const chip = (f: CollectionFilter, label: string, count?: number) => (
    <button
      key={`${f.kind}${f.kind === 'one' ? f.id : ''}`}
      type="button"
      className={`collection-chip${isActive(f) ? ' is-active' : ''}`}
      aria-pressed={isActive(f)}
      onClick={() => onChange(f)}
    >
      {label}
      {count != null && <span className="collection-chip__count kh-mono">{count}</span>}
    </button>
  );

  return (
    <div className="collection-bar">
      <nav className="collection-chips" aria-label={lang === 'en' ? 'Trip groups' : '여행 묶음'}>
        {chip({ kind: 'all' }, lang === 'en' ? 'All' : '전체')}
        {chip({ kind: 'unclassified' }, lang === 'en' ? 'Unsorted' : '미분류')}
        {collections.map((c) => chip({ kind: 'one', id: c.id }, c.name, c.itemCount))}

        {adding ? (
          <form
            className="collection-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate(name.trim());
            }}
          >
            <input
              className="kh-field collection-add__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder={lang === 'en' ? 'Trip name' : '여행 이름'}
              aria-label={lang === 'en' ? 'New group name' : '새 묶음 이름'}
              onBlur={() => !name.trim() && setAdding(false)}
            />
            <button type="submit" className="collection-add__ok" disabled={create.isPending}>
              {lang === 'en' ? 'Add' : '추가'}
            </button>
          </form>
        ) : (
          <button type="button" className="collection-chip collection-chip--add" onClick={() => setAdding(true)}>
            {lang === 'en' ? '+ New group' : '+ 새 묶음'}
          </button>
        )}
      </nav>

      {filter.kind === 'one' && (
        <CollectionActions
          collection={collections.find((c) => c.id === filter.id)}
          lang={lang}
          onGone={() => onChange({ kind: 'all' })}
        />
      )}
    </div>
  );
}

/** 선택된 묶음의 이름 변경·삭제 — 항상 보이면 목록이 시끄러워 선택했을 때만 낸다 */
function CollectionActions({
  collection,
  lang,
  onGone,
}: {
  collection: FavoriteCollection | undefined;
  lang: 'ko' | 'en';
  onGone: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(collection?.name ?? '');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['favorites'] });

  const rename = useMutation({
    mutationFn: (value: string) => renameCollection(collection!.id, value),
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteCollection(collection!.id),
    onSuccess: () => {
      onGone();
      refresh();
    },
  });

  if (!collection) return null;

  return (
    <div className="collection-actions">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) rename.mutate(name.trim());
          }}
        >
          <input
            className="kh-field collection-add__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            aria-label={lang === 'en' ? 'Group name' : '묶음 이름'}
          />
          <button type="submit" className="collection-add__ok">
            {lang === 'en' ? 'Save' : '저장'}
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            className="collection-action"
            onClick={() => {
              setName(collection.name);
              setEditing(true);
            }}
          >
            {lang === 'en' ? 'Rename' : '이름 변경'}
          </button>
          <button
            type="button"
            className="collection-action collection-action--danger"
            onClick={() => remove.mutate()}
          >
            {/* 묶음을 없애는 것과 장소를 버리는 것은 다른 일이다 — 문구로도 분명히 한다 */}
            {lang === 'en' ? 'Delete group (keeps places)' : '묶음만 삭제'}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 카드 하나를 묶음으로 옮기는 선택기.
 *
 * 하트에 붙이지 않는다 — 하트 한 번은 그대로 즉시 찜이어야 한다 (ADR-0080 §5).
 * 매번 묶음을 묻는 순간 찜이 "누르는 것"에서 "결정하는 것"이 되고, 지도에서 훑어보다
 * 가볍게 찍어두는 사용이 사라진다.
 */
export function MoveToCollection({
  type,
  targetKey,
  current,
  collections,
  lang,
}: {
  type: FavoriteTargetType;
  targetKey: string;
  current: number | null;
  collections: FavoriteCollection[];
  lang: 'ko' | 'en';
}) {
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (id: number | null) => moveFavorite(type, targetKey, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return (
    <label className="collection-move">
      <span className="visually-hidden">{lang === 'en' ? 'Move to group' : '묶음으로 이동'}</span>
      <select
        className="collection-move__select"
        value={current ?? ''}
        disabled={move.isPending}
        onChange={(e) => move.mutate(e.target.value === '' ? null : Number(e.target.value))}
      >
        <option value="">{lang === 'en' ? 'Unsorted' : '미분류'}</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

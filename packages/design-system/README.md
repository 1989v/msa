# @kgd/design-system

전체 프로젝트 frontend 의 시각 통일을 위한 디자인 시스템.
**OKLCH 토큰 + 5 핵심 React 컴포넌트** (KpiCard, StatCard, ListRow, SegmentControl, PrimaryButton).

📖 **자세한 명세**: [`docs/conventions/design-system.md`](../../docs/conventions/design-system.md)

## 빠른 사용

```bash
# 디자인 시스템 변경 후 — 3 FE 의 vendored tarball 갱신
scripts/sync-design-system.sh
```

```tsx
// frontend src/main.tsx
import '@kgd/design-system/tokens.css';

// 페이지에서
import { KpiCard, StatCard, ListRow, SegmentControl, PrimaryButton } from '@kgd/design-system';
```

## 빌드

```bash
cd packages/design-system
npm install
npm run build       # → dist/index.js + dist/tokens.css + dist/styles.css
npm pack            # → kgd-design-system-X.Y.Z.tgz
```

## 컴포넌트 추가 절차

1. `src/components/<Name>.tsx` + `<Name>.css` 작성 (토큰만 사용, hex 금지)
2. `src/index.ts` export 추가
3. `package.json` version bump
4. `scripts/sync-design-system.sh` 실행 → 3 FE 갱신
5. `docs/conventions/design-system.md` §4 에 API 추가

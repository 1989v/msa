import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { glob } from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // CSS Modules + raw .css 자체 처리: tsup 은 .css import 를 소스 보존하므로
  // onSuccess 에서 별도 복사. 컴포넌트 .module.css 는 dist/components/ 로,
  // tokens.css 는 dist/tokens.css 로, styles.css 는 모든 module.css 합본으로.
  loader: {
    '.css': 'copy',
  },
  async onSuccess() {
    // tokens.css 와 module css 들을 dist 로 복사
    const fs = await import('node:fs');
    const path = await import('node:path');
    const srcDir = path.resolve('src');
    const distDir = path.resolve('dist');

    // 1) tokens.css 복사
    fs.copyFileSync(path.join(srcDir, 'tokens.css'), path.join(distDir, 'tokens.css'));

    // 2) 모든 component .css 합본 → styles.css (선택적 import 용 fallback,
    //    예: 토큰만 쓰고 컴포넌트는 가져가지 않는 경우 등은 미필요)
    const componentsDir = path.join(srcDir, 'components');
    const cssFiles = fs
      .readdirSync(componentsDir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => path.join(componentsDir, f));

    let combined = '/* @kgd/design-system — auto-generated styles bundle */\n';
    for (const file of cssFiles) {
      combined += `\n/* ===== ${path.basename(file)} ===== */\n`;
      combined += fs.readFileSync(file, 'utf-8') + '\n';
    }
    fs.writeFileSync(path.join(distDir, 'styles.css'), combined);
  },
});

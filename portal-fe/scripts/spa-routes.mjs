import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The router declarations are the contract. No independent route allowlist. */
export function extractRoutes(source) {
  const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Route') {
      const path = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'path');
      if (!path?.initializer || !ts.isStringLiteral(path.initializer)) throw new Error('Route path must be a literal for initial HTTP routing');
      if (path.initializer.text !== '*') {
        const guards = [];
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) guards.push(parent.left.getText(ast));
        }
        if (guards.some((guard) => !['isResumeHost', 'blogRoutesEnabled', 'rankRoutesEnabled', 'adsRoutesEnabled'].includes(guard))) throw new Error(`Unknown route host guard: ${guards}`);
        const sensitivity = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'caseSensitive');
        let caseSensitive = false;
        if (sensitivity) {
          if (!sensitivity.initializer) caseSensitive = true;
          else if (ts.isJsxExpression(sensitivity.initializer) && sensitivity.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword) caseSensitive = true;
          else if (!(ts.isJsxExpression(sensitivity.initializer) && sensitivity.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword)) throw new Error('Route caseSensitive must be a literal');
        }
        routes.push({ path: path.initializer.text, guards, caseSensitive });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!routes.length) throw new Error('No router declarations found');
  return routes;
}
export function pathPattern(path) {
  if (path === '/') return '/';
  const wildcard = path.endsWith('/*');
  const parts = (wildcard ? path.slice(0, -2) : path).split('/').map((part) => part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return parts.join('/') + (wildcard ? '(?:/.*)?' : '/?');
}
function hostPattern(guards) {
  if (guards.includes('isResumeHost')) return 'resume\\.[^:]+';
  // App allows these on the owning host and every non-apex host.
  if (guards.includes('blogRoutesEnabled') || guards.includes('rankRoutesEnabled') || guards.includes('adsRoutesEnabled')) return '(?!1989v\\.com:)[^:]+';
  return '[^:]+';
}
export function permitsRoute(routes, host, path) {
  const pathname = new URL(path, 'https://example.test').pathname;
  return routes.some((route) => new RegExp(`^${hostPattern(route.guards)}:${pathPattern(route.path)}$`, route.caseSensitive ? '' : 'i').test(`${host}:${pathname}`));
}
export function nginxRouteMap(routes) {
  return '# Generated from App.tsx. Do not edit.\nmap "$host:$uri" $spa_route_allowed {\n  default 0;\n' + routes.map((route) => `  ~${route.caseSensitive ? '' : '*'}^${hostPattern(route.guards)}:${pathPattern(route.path)}$ 1;`).join('\n') + '\n}\n';
}
export const NOT_FOUND_HTML = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>페이지를 찾을 수 없습니다 | 1989v</title></head><body><main><h1>페이지를 찾을 수 없습니다 / Page not found</h1><p>주소를 확인하거나 홈에서 서비스를 찾아보세요.</p><a href="/">홈으로 / Home</a> · <a href="https://1989v.com/#services">서비스 둘러보기 / Explore services</a></main></body></html>';
async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const routes = extractRoutes(await readFile(resolve(root, 'src/App.tsx'), 'utf8'));
  await mkdir(resolve(root, 'dist/seo'), { recursive: true });
  await writeFile(resolve(root, 'dist/seo/spa-routes.conf'), nginxRouteMap(routes));
  await writeFile(resolve(root, 'dist/404.html'), NOT_FOUND_HTML);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

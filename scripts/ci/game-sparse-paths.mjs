/** CI runs this with plain Node before npm install. Keep imports dependency-free.
 * Retain the historical test directories, then include only the exact source
 * files referenced by the shared guide registry, not whole game asset trees.
 */
import { catalogGuides } from '../../portal-fe/src/seo/gameGuideCatalog.mjs';
import { gameGuideSources, gameSelectionGuide } from '../../portal-fe/src/seo/gameGuide.mjs';

const directories = ['lib', 'marble-race', 'card-flip', 'ladder-draw'];
const slugs = new Set([
  ...Object.keys(catalogGuides),
  ...gameSelectionGuide('en').picks.map(pick => pick.slug),
]);
const sources = new Set([...slugs].flatMap(gameGuideSources));
const literal = path => {
  if (!path || path.startsWith('/') || path.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`Invalid game guide source path: ${path}`);
  }
  // No-cone sparse patterns use gitignore glob syntax. Anchor and escape each
  // filename so a future source containing a metacharacter still stays literal.
  return '/' + path.replace(/[\\*?[\]]/gu, '\\$&');
};

process.stdout.write([
  ...directories.map(path => literal(path) + '/'),
  ...[...sources].sort().map(literal),
].join('\n') + '\n');

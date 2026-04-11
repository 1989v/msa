# Office Assets (CC0)

Third-party pixel art assets for the Pixel Office view.

All packs below are **Creative Commons Zero (CC0 1.0)** — free for any use
including commercial, no attribution required (but crediting the creators is
appreciated).

## Included Packs

### kenney-modern-city/
- **Source**: https://kenney.nl/assets/roguelike-modern-city
- **Author**: Kenney (https://www.kenney.nl)
- **License**: CC0 1.0 Universal — see `kenney-modern-city/License.txt`
- **Contents**: 1036 tiles at 16×16 px, packed into `Tilemap/tilemap_packed.png`
  (592×448, 37 cols × 28 rows, no spacing). Urban exteriors, floors, walls,
  benches, lamps, plants, furniture elements.

### kenney-tiny-town/
- **Source**: https://kenney.nl/assets/tiny-town
- **Author**: Kenney (https://www.kenney.nl)
- **License**: CC0 1.0 Universal — see `kenney-tiny-town/License.txt`
- **Contents**: 132 tiles at 16×16 px, packed into `Tilemap/tilemap_packed.png`
  (192×176, 12 cols × 11 rows, no spacing). Includes character sprites
  (front-facing, single frame).

## Coordinate System

All packed tilemaps use this layout:
- Tile at grid (col, row) → source pixel rect `(col*16, row*16, 16, 16)`
- No padding/spacing between tiles in the `packed` variant

## Usage

See `agent-viewer/front/src/office/assets/catalog.ts` for the semantic mapping
from names (e.g. `"desk"`, `"character-0"`) to `(sheetId, col, row)` tuples.

To add new packs, drop them here with their `License.txt` and extend
`catalog.ts`.

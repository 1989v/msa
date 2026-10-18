---
version: 1.0.2
extends: ../../../DESIGN.md
archetype: k-heritage-arcade
tokens:
  surface: { ink: 'root kh-ink', slab: 'root kh-giwa' }
  text: { primary: 'root kh-hanji', muted: '70% hanji mixed with ink' }
  action: 'root kh-yeonji'
  structure: 'root kh-ocher'
  territory: ['rgb(89 163 181)', 'root kh-ocher', 'rgb(204 104 100)', 'rgb(121 166 124)', 'rgb(155 136 188)', 'rgb(171 185 190)']
  spacing: [4, 8, 12, 16, 24, 32]
  radius: 4
  touch_minimum: 44
---

# Territory sample design

## 1. Overview
Dominant top-down battlefield in a restrained heritage arcade shell. Read root DESIGN.md §12 before editing. Local RGB mappings live only in the sample stylesheet; shared tokens remain the source for shell choices.

## 2. Colors
Ink ground, giwa panels, hanji text, ocher rules and labels, yeonji primary start/retry. Six dedicated territory identifiers above are sample game-state tokens, not financial status colors. Distinguish players with names, circular markers and three patterns in addition to color.

## 3. Typography
System/Pretendard sans for Korean; system monospace for metrics and technical labels. Title 24px, area/rank 30px (24px mobile), secondary labels 10–13px. No downloaded fonts.

## 4. Layout & spacing
The field fills100dvw×100dvh (vw/vh fallback) with no permanent header/sidebar. Compact HUD floats upper-left, transparent TOP10 upper-right, touch pad lower-left, map toggle lower-right; safe-area insets protect controls. The map starts hidden and opens above its toggle as a translucent click-through square with transparent empty terrain. Cosmetics/settings live in a closed-by-default scrollable overlay. Opening pauses; closing does not resume. During placement, current-position/cancel controls float separately from the closed drawer. Short-landscape overrides keep placement actions above the touch pad. All interactive controls remain at least44px high; direction keys48×48px. Browser fullscreen is not required.

## 5. Elevation & depth
No card shadows or gradients. Flat surfaces, one-pixel ocher-mixed rules, contiguous territory fills, crisp ownership borders and opaque dialog content separate layers.

## 6. Shapes
4px control corners. Territory logic remains square cells; rendering merges contiguous same-owner cells and draws only ownership perimeters. Sparse world-anchored hatches/dots replace individual tile seams. Trails are continuous round-cap/join strokes. Circular markers show player positions. The human has an extra hanji ring and name; the minimap viewport uses hanji. Display cells are 10px desktop / 8px mobile; world remains 720×720. Upper-right TOP 10 standings have a fully transparent background, five rows per page, six active seconds per page and pointer-events:none. Names, area and approximate coordinates use restrained text shadows without a panel; page changes are instant, including reduced motion.

## 7. Components & states
Start/retry is the primary action. Buttons have hover, focus-visible and pressed feedback. Pause has aria-pressed; dialog uses native modal behavior. Death provides a specific reason and respawn. Save success/failure is text. No asynchronous network loading state exists.

## 8. Do's and don'ts
- Keep battlefield dominant; put mobile controls below it.
- Keep the truthful local simulation label visible.
- Use token variables for rendered UI and canvas colors.
- Render user text with textContent/canvas text only.
- Respect reduced motion and pause on hidden/focus loss.
- Do not add remote ads, online counts or fictional network indicators.
- Do not mistake source review for measured browser contrast or interaction verification.

## Anchored cosmetics
Solid/dashed perimeter choices retain the existing palette and equal mechanics. Signs use built-in flag/star/leaf symbols and short plain text on a bounded 168×19px ink label with owner-color rule/pole. Max three per human, offscreen culling, owned-cell anchors and automatic loss/death cleanup. Explicit placement status/crosshair, current-position keyboard button, cancel/Escape and intentional resume. Existing sidebar layout and token mappings are reused.

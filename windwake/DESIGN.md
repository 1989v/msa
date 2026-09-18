---
version: 1.0.0
archetype: wind-worn
extends: ../DESIGN.md
tokens:
  colors:
    ink: { css: 'hsl(204 25% 13%)', role: 'HUD and menu surface' }
    paper: { css: 'hsl(44 42% 92%)', role: 'primary text' }
    muted: { css: 'hsl(42 20% 75%)', role: 'secondary text' }
    wind: { css: 'hsl(164 40% 67%)', role: 'energy, gliding and resonance' }
    amber: { css: 'hsl(39 84% 66%)', role: 'quest, treasure, focus' }
    danger: { css: 'hsl(8 75% 68%)', role: 'health, enemy attacks' }
    grass: { rgb: [0.29, 0.47, 0.35], role: 'meadow terrain' }
    rock: { rgb: [0.59, 0.59, 0.49], role: 'stone and platform' }
    sky: { rgb: [0.67, 0.80, 0.79], role: 'sky and distance fog' }
  typography:
    family: 'system-ui, sans-serif'
    display: 'Georgia, serif'
    scale: { small: 14, base: 16, title: 32, display: 72 }
  spacing: { base: 4, small: 8, medium: 16, large: 24, section: 48 }
  radius: { small: 4, medium: 8 }
  motion: { fast: 100, base: 200 }
---

## 1. Overview
Quiet, wind-worn exploration. Warm ruins and colored cloth interrupt broad muted landscapes. Root typography/spacing/accessibility conventions apply; this isolated game extends the palette for a daylight world.

## 2. Colors
All interface colors reference tokens in style.css; procedural world colors use named PALETTE entries in renderer. Amber marks discovery, wind marks usable energy, danger marks threats. Shape and text always accompany status colors.

## 3. Typography
System sans-serif body; restrained serif title. Readable 16px body and 14px compact controls. Title carries the identity, HUD leaves the world visible.

## 4. Layout & Spacing
Four-pixel rhythm, full-viewport world, top-left vitals, top-right quest, bottom contextual action. Minimum 44px interactive targets. Touch uses corner controls and safe-area insets.

## 5. Elevation & Depth
Actual perspective and world occlusion create depth. Interface uses opaque ink surfaces only where text crosses the world; no decorative glass cards.

## 6. Shapes
Small corners on controls. Thin rules and diamonds identify relics. Large interface panels remain flat and spacious.

## 7. Components × States
Buttons: paper/default, amber/hover, dark/active, amber outline/focus, muted/disabled. Map pins: named/default, amber/hover/focus, paper/active, muted/undiscovered. Menu tabs: muted/default, paper/hover, amber/active/focus. Sliders: wind/default, paper/hover, amber/focus, muted/disabled. Loading and errors use explicit text.

## 8. Do's and Don'ts
- Do not hide gameplay under decorative panels.
- Do not use remote fonts or image assets.
- Do not encode enemy telegraphs only through color.
- Do not remove visible keyboard focus.
- Do not shake the camera under reduced motion.
- Do not use glowing glass cards or gradient lettering.

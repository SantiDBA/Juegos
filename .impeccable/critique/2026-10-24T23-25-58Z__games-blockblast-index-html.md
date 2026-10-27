---
target: the Block Blast game (games/blockblast)
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/santiago/Github/Juegos/games/blockblast/index.html"
target_fingerprint: "sha256:5ca6caeaafcb6fed2d72942ec8311f7e75c8826c1a15567c3569477d6832dd1d"
target_path: /Users/santiago/Github/Juegos/games/blockblast/index.html
timestamp: 2026-10-24T23-25-58Z
slug: games-blockblast-index-html
closed: true
---
# Impeccable Critique — Block Blast (`games/blockblast`)

Method: dual-agent (A: design-review sub-agent · B: detector/browser sub-agent)

> Vision was unavailable this session (the `vision` tool and image reads failed for both sub-agents and the orchestrator), so no human-eye screenshot review was possible. Assessment A substituted measured evidence: DOM boxes, computed styles, live-canvas pixel probes, and screenshot pixel sampling. Assessment B drove a real browser and ran the live detector.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The drag preview is exemplary, but the most common move (a placement that clears nothing) scores 0, floats nothing, toasts nothing — no status for ~90% of actions |
| 2 | Match System / Real World | 3 | Plain, honest Spanish ("no entra ahí"); but "línea 8" and "movs" are not actionable and the start hint is the designer's rationale, not the player's language |
| 3 | User Control and Freedom | 1 | No undo, no cancel of a placed piece, no restart/quit (you must lose), no pause; releasing off-board is a silent, undiscoverable escape |
| 4 | Consistency and Standards | 2 | `aria-pressed` disagrees with the visible label; overlay isn't modal (`.back`/`#sound` z-index 20 > overlay 10); "puntos" vs "Puntaje"; saved level never resumed |
| 5 | Error Prevention | 1 | Tray hit boxes are invisible 44×44 rects with 11px dead gaps; the piece is drawn under the fingertip; near board edges no invalid feedback exists |
| 6 | Recognition Rather Than Recall | 2 | Preview + real shapes (good), but the 5 slots render at 5 different pitches, and scoring/combo rules are never explained |
| 7 | Flexibility and Efficiency | 0 | Pointer-drag is the only modality: no keyboard play, no tap-piece→tap-cell, no rotation, no undo, no restart; 4 of every 5 rolled pieces are discarded unseen |
| 8 | Aesthetic and Minimalist Design | 2 | Canvas is restrained; the HUD is 6 readouts where `línea`/`movs` are decoration; "el color no importa" stated twice while the board uses 4 saturated colors |
| 9 | Error Recovery | 1 | The common failure (piece doesn't fit inside board bounds → `ghostCell = null`) gives no ghost, no red outline, no toast |
| 10 | Help and Documentation | 1 | Onboarding exists, but the same block is reused on level-clear/game-over, advertises the `M` key on phones, and never explains scoring, combos or levels |
| **Total** | | **15/40** | **Poor (37.5%)** |

All ten heuristics applied (a game genuinely has flexibility and help surfaces), so the maximum is /40.

---

## Design Specificity Verdict

**The board is authored; the shell is borrowed.** Everything inside the canvas is genuinely this game: a rim-lit frame over a radial wash, a drawn well per cell (not a dot grid), 4-color blocks with a diagonal gradient, a dark seam and lit top edge so adjacent blocks don't merge, and a tray plate that groups the hand. `render.ts` reasons about all of it in comments. That is bespoke board-game craft.

Everything *around* the canvas is the portal's dark dashboard wearing a puzzle: an opaque stats card of six monospace readouts, a 4px unlabeled progress bar, and two "surfaces" whose fills measure at ~1.02:1 against each other so they dissolve into one flat field. Swap the h1 and this chrome could report a build. Measured: HUD fill 1.02:1 vs page background, border 1.29:1; tray slot fill 1.16:1 vs tray plate; board at 1.15:1 behind the 76% start scrim. Net: category-aware *rendering*, category-interchangeable *composition and chrome*.

**Deterministic scan:** the bundled detector exits **2** with **13 findings** in `index.html` — **9× `undersized-ui-text`** (the six HUD labels at 8px, `combo` at 9px, both legend chips at 10px, all below an 11px floor), **1× `tiny-text`** (11px body), **2× `dark-glow`** (a zero-offset cyan `text-shadow` glow on `#overlay-title`, reported twice), and **1× `layout-transition`** (`transition: width` on `#progress-fill`). The **live browser scan** added the rule the static pass missed: **`ai-color-palette`** — "cyan neon text on dark background" on `#overlay-title`, a cyan gradient on `#progress-fill`, and (likely a false positive) the `chip-fall` semantic color. So the mechanical pass independently confirms A's two headline gripes: the text is too small to read, and the neon-on-dark chrome is generic.

**Visual overlays:** injection succeeded — the detected elements are outlined in the **[Human]** tab the browser opened, with the console header `[impeccable] 13 anti-patterns found` (13 elements; 16 instances). The temporary live server was stopped after the scan.

---

## Overall Impression

The thing you actually touch is the best part: a hand-drawn board and a drag interaction that snaps piece, shadow and destination into one computation, then lights the cells that will clear. It's already better than most of its genre at the one moment that matters.

The problem is everything around that moment. Most moves are rewarded with silence — no points, no floater, no sound beyond a tick — so the loop teaches "wait for a clear," not "plan." Meanwhile the chrome is a 1:1-on-1 dark dashboard that says nothing about this game, six stats compete with the score, and the end-of-run screen is still the beginner's manual. The single biggest opportunity: **make every placement feel like it landed**, and let the board's personality (four vivid colors) be the first thing a visitor sees instead of a near-black field.

---

## What's Working

1. **`drawPreview` + `computePreview`.** Cells that will clear get the piece's color at 42% alpha plus a *uniform white* ring, computed on `board.clone()` so nothing mutates until release. The ring is deliberately color-agnostic because color doesn't determine completeness. This is what converts "placing pieces" into "planning."
2. **The drag is rendered snapped, at board scale.** Piece, shadow and landing share one computation; `updateDrag` snaps to the destination rather than following the pointer. A whole class of "it didn't go where I aimed" errors is designed out.
3. **Board-rendering discipline.** Diagonal gradient + `blockSeam` + lit top edge, one `shadowBlur` on the frame, and 64 wells baked into a cached `getBackdrop` layer rather than per-cell shadows — bespoke *and* perf-conscious. Keep this.

---

## Priority Issues

### [P0] Almost every move is rewarded with nothing
- **What:** `gained = result.cleared * TUNING.pointsPerCell`, so a placement that clears nothing scores **0**, floats nothing (`floaters.push` only runs when `anchorOfLines` returns non-null), toasts nothing, and changes only the sound and `movs`. That is roughly 90% of the core loop.
- **Why it matters:** The player's only positive signal is a rare event, so the game teaches luck rather than planning — inverting the "planificar" pitch on the portal card. This is the single thing that makes it feel dead between clears.
- **Fix:** Score the placement itself (1–2 pts per placed cell, or a small "área" tally) and call the existing `floaters.push` on **every** valid placement at the piece centroid; give the landed block a ~120ms scale-in so the board visibly accepts it.
- **Suggested command:** `/impeccable delight`

### [P1] The tray is unreadable and an unreliable input target
- **What:** slot fill is **1.16:1** against the plate; the hit rect is an invisible 44×44 box with **11px dead gaps** at 55px pitch on mobile; each shape renders at its own pitch (a 1×1 draws ~19px blocks, a 1×5 a ~28×5px sliver); and the piece is drawn under the fingertip.
- **Why it matters:** Five pieces look like five different materials and the player aims at invisible boxes — the primary input fails silently near slot boundaries and under the finger.
- **Fix:** Lift each slot to ~3:1 against the tray and glow the active one; render every piece on one shared pitch (or in a fixed 3×3 ghost grid) so shapes are comparable; widen the hit test to the full 55px slot to kill the dead gaps; on touch, offset the dragged piece ~1.2 cells above the finger.
- **Suggested command:** `/impeccable adapt`

### [P1] The end-of-run panel is the reused onboarding card, and the record is occluded
- **What:** `setOverlayTitle` swaps only title/tagline/button, so `se acabó` sits on top of the three beginner bullets, both legend chips and "El tablero arranca vacío…". The `flashBest()` animation runs on `#best` **under** the 76% scrim.
- **Why it matters:** The last thing a losing player reads is a beginners' manual, and the one celebration the code writes is invisible. Peak-end rule fails at the peak.
- **Fix:** Hide `.keys/.legend/.hint` whenever state ≠ menu; put the record, lines cleared, and delta-vs-previous-best on the end panel itself; raise the HUD above the scrim (or move the celebration into the panel).
- **Suggested command:** `/impeccable polish`

### [P1] Accessibility and legibility gaps compound
- **What:** `maximum-scale=1.0, user-scalable=no` blocks pinch-zoom while HUD labels are **8–9px** (detector: 9 `undersized-ui-text` findings) and the gridline is **2.08:1** against the cell fill; play is drag-only (canvas has no `tabindex`); `#toast` has no `aria-live`; `aria-pressed` conflicts with the label; `comboPulse` animates `infinite` with no `prefers-reduced-motion` path.
- **Why it matters:** A player with low vision can't resolve the grid *and* can't zoom; a keyboard or screen-reader player can't play at all.
- **Fix:** Remove `maximum-scale`/`user-scalable=no`; lift labels to ≥11px and the well edge to ≥3:1; add tap-piece→tap-cell plus a focusable grid with arrow-key placement; `aria-live="polite"` on the toast; fixed accessible name "sonido" with `aria-pressed` carrying the state; reduced-motion guards for `comboPulse` and the pop/float decays.
- **Suggested command:** `/impeccable audit`

### [P2] Dead level persistence, a steep grind, and rectangle-only shapes
- **What:** boot calls `newLevel(readLevel())`, but Jugar calls `newLevel(1)`, so `saveLevel`/`readLevel` are effectively dead. `targetForLevel = 300 × 1.35^(n−1)` with no timer, move cap, new mechanic or board reset → level 10 needs ~4,100 pts, level 20 ~700,000. `TUNING.shapes` is only `1x1…1x5`, `2x2`, `2x3`, `3x2` — no L/T/S/Z, so almost everything fits and the board rarely locks.
- **Why it matters:** Progression is numbered but never *felt*, and without awkward shapes the genre's tension (obstinate pieces + an emptying tray) is absent.
- **Fix:** Resume at the saved level (or split "repetir nivel" from "empezar de nuevo"); flatten the curve; reset the board on level clear; add L/T/S/Z polyominoes; and consider 3–4 pieces with a full-tray refill plus a bonus for emptying it.
- **Suggested command:** `/impeccable harden`

---

## Persona Red Flags

**Jordan (first-timer)**
- The `.panel` stacks h1 + tagline + 3 bullets + 2 chips + button + hint — six blocks, one 11–13px weight class, no reading path; only `#play` wins, because it's the sole accent fill.
- Tray slots are invisible (1.16:1) → five loose shapes, not "a hand of five"; a 1×1 and a 1×5 don't read as the same object type.
- After several scoreless placements, Jordan re-reads the panel and finds **no scoring explanation at all**.

**Casey (distracted mobile)**
- At 390×844: board 352px, **208px of empty space below the tray**, a **100px gap** between HUD and board; `.hud-row` only occupies the middle 195px.
- HUD labels are **8px** uppercase at 0.16em — unreadable at arm's length.
- `snappedCenter` draws the piece centered on the pointer, so the fingertip covers the target cell; there is no tap-tap alternative.
- Near board edges `dragTargetCell` returns `null` → `drawInvalidTarget` bails on `!state.ghost` → no ghost, no red dashes, no toast: silence, then the piece snaps home.
- The third `.keys` bullet tells her to press **M**; she has no keyboard.

**Alex (power user)**
- No keyboard play (`canvas` not focusable; only `KeyM` bound), no undo, no cancel, no restart without losing, no tray reordering — heuristic 7 is empty.
- `rollTray` builds 5 pieces per move and the tray keeps one (`pool.shift() ?? p`); Alex never sees the four discarded.
- Combo needs three *consecutive* clearing placements and resets on any normal (non-clearing) placement, so `comboMax = 5` and the `sfx.line` tiers are effectively unreachable content.

---

## Minor Observations

- `¡línea!` toasts on *every* single-line clear; after twenty clears it's wallpaper and competes with `¡N líneas!`. Reserve it for multi-line clears.
- "el color no importa" appears twice on the start panel (tagline + `.chip-fall`) while the board uses four saturated colors that imply the opposite.
- `#line` shows the last cleared line's length as a bare integer; `movs` is a counter with no consequence. Relabel to something actionable ("borradas") or cut them.
- The `M`-key hint, the `levels.ts` rationale in `.hint`, and the level-clear "puntos" vs game-over "Puntaje" vocabulary all drift.
- The `dark-glow` (cyan `text-shadow`) and `ai-color-palette` (cyan neon on dark) findings are the "generic AI dashboard" tell — worth replacing even if it's the portal's house style.
- On desktop the board centre sits at x≈782 against a 720px window centre, leaving ~860px of dead visual mass in a 1440px frame.
- `dragPx/dragPy` stay `0,0` until the first `pointermove`, so the dragged piece flashes to the canvas origin for one frame after `pointerdown`.
- `saveBest` runs only in `endGame`; closing the tab mid-run loses the record.
- Worth keeping: the `getBackdrop` cache keyed on layout/DPR, the shared `slotMetrics` used by both `render` and `input`, and the documented monotonic `nextPieceId` fix.

---

## Questions to Consider

1. Show a stranger a mid-game screenshot: the board is unmistakably bespoke, but the six-readout monospace card would fit a build monitor. Which half is the product — and if the chrome is just host shell, why does it take the top-left third of the layout and sit ~274px from the thing it reports on?
2. The genre's tension lives in awkward shapes and a tray that empties. Every piece here is a rectangle, the tray never empties, and most moves score nothing. Is this a *planning* puzzle or a *tapping* toy — and where is the irreversible move that makes planning matter?
3. If almost every placement is silent and scoreless, what is the player actually doing in the ninety seconds between clears — and would they call that "fun," or "waiting"?

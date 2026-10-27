---
target: the Block Blast game (games/blockblast)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/santiago/Github/Juegos/games/blockblast/index.html"
target_fingerprint: "sha256:87842c281a38095a83c958b33ecfe05e25c398f789c0ab675dfb91ad829181ee"
target_path: /Users/santiago/Github/Juegos/games/blockblast/index.html
timestamp: 2026-10-25T14-05-10Z
slug: games-blockblast-index-html
---
# Impeccable Critique — Block Blast (`games/blockblast`) — re-run

Method: dual-agent (A: design-review sub-agent · B: detector/browser sub-agent)

> Vision was unavailable this session (the `vision` tool and image reads returned "No image is in this conversation" for both sub-agents and the orchestrator), so no human-eye screenshot review happened. Assessment A substituted measured evidence: DOM/computed-style reads, canvas pixel probes, rendered-PNG sampling, contrast math, and screenshot A/B diffs. Assessment B drove a real browser and ran both the static and the live detector. Two of A's severe findings were independently re-verified in the parent context (see Priority Issues).

This is the first re-run since the 8-command fix pass. Score moved **15/40 → 28/40**.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:----:|-----------|
| 1 | Visibility of System Status | 3 | Strong in play (progress bar, combo, tray used-state, ghost, preview, floaters, layered sfx). But two "pts" on screen at level clear (`626 pts` panel vs `PUNTOS 2150` HUD), and the HUD `RÉCORD` lags the panel's `nuevo récord` |
| 2 | Match System / Real World | 3 | `LÍNEA` is a bare number with no unit or referent; `META`/`LÍNEA`/`MOVS` are never defined. "mano" / "no entra ahí" metaphor is coherent |
| 3 | User Control and Freedom | 3 | Escape cancels selection, drag-cancel is free, invalid drops cost nothing — but no undo, hold, or pause in a game whose tension is "you can ruin your board", and no way to clear saved progress |
| 4 | Consistency and Standards | 2 | (a) modal veil still the old cold `rgba(6,8,14,.76)`; (b) `.back`/`#sound` z-index 20 over overlay 10, so chrome floats lit above every modal and stays clickable; (c) reduced-motion targets `#best.beat` while the class lands on `.result` — the rule never fires |
| 5 | Error Prevention | 3 | Line-clear preview is excellent prevention; invalid drops are penalty-free. But placements are permanent, the board can lock with zero warning, no confirm on leaving a run |
| 6 | Recognition Rather Than Recall | 3 | Pieces drawn as shapes, used slots stay framed, preview ring, legend chips. But the hand-refill rule is intro-only (gone after one press) and `META`/`LÍNEA` must be inferred |
| 7 | Flexibility and Efficiency | 3 | Two real input paths (pointer; 1–3/arrows/Enter/Escape/M) sharing one preview pipeline. Missing: no key to cycle pieces, no centroid snap, no undo/hold, no speed option |
| 8 | Aesthetic and Minimalist Design | 3 | Canvas craft is genuinely good. Deductions: six HUD metrics for one rule, and title / level-clear / game-over headlines all share one 48px/800 amber style |
| 9 | Recognize/Diagnose/Recover from Errors | 2 | Rejection is a buzz + dashed ring only, and the error copy is dead code (`'no entra ahí'` is unreachable — both call sites guard with `pieceFits()`). Game over never names the blocking piece |
| 10 | Help and Documentation | 3 | Intro panel is genuinely good (rule + keys + legend + refill hint). But it disappears forever after one press; no in-game help/pause; `LÍNEA`/`META` undocumented; no non-visual representation of tray or board |
| **Total** | | **28/40** | **Good (70%)** |

All ten heuristics applied, so the maximum is /40.

---

## Design Specificity Verdict

**Authored for this game, not a reskinned dark canvas.** The palette is a deliberate warm espresso/amber chosen specifically to stop the blue block disappearing into a blue canvas; the board is an object (frame + halo + per-cell wells + block seams + highlight stripes), not a dot grid; pieces are drawn as their real polyomino shapes in a grouped tray plate; and the SFX set is keyed to this game's actual events (grab / place / invalid / line with pitch rising per combo / multi-line / hand-clear / level / game-over / record). Copy and legend chips teach *this* rule.

The generic residue is narrow but real: the HUD is a six-metric monospace telemetry block that reads like a dashboard, and the modal veil is **cold** blue-black (`rgba(6,8,14,0.76)`) left over from the previous cool palette — measurably it turns the warm canvas grey-blue (un-veiled `(24,18,14)` → veiled `(11,11,14)`: red cut to 46% while blue is untouched). Authored, with two inherited chrome leftovers.

**Deterministic scan:** the detector exits **0** with **0 findings**, and the injected in-browser detector reported `[impeccable] No anti-patterns found.`. Verified genuine, not a silent no-op: a control fixture (`font-family: Inter`) returned a real finding with exit 2 on the same engine. Engine: `impeccable-engine 0.1.5`. The linked stylesheet (`src/style.css`, 489 lines) was in scope.

**Visual overlays:** injection succeeded — the front end outlined **nothing** (no anti-patterns) in Assessment B's tab, and the console header reported clean. The temporary live server was stopped.

---

## Overall Impression

The fix pass landed. The thing that made the first critique damning — most moves rewarded with nothing — is closed and verifiable: a non-clearing placement now scores, floats, sounds, and settles. The line-clear preview is still the best thing in the product, and the keyboard path is real and shares the same preview pipeline as the drag, so both teach the same rule.

The score gap to "Excellent" is now about *edges*: a layout regression that lets the HUD sit on top of the board's first row on short phones, an ending that is typographically the front door and arrives with no warning, and two inherited leftovers (a cold veil, a reduced-motion rule pointing at a class that no longer exists). Nothing here is a rethink; all five are surgical.

---

## What's Working

1. **The line-clear preview is the feature that makes this a puzzle.** Cells that will clear get a thick pure-white ring, identically for drag and keyboard. Verified live: 15,599 pure-white pixels forming a bbox of exactly one 8-cell row. It is also the highest-contrast element on screen — arguably *too* dominant, but it earns its weight.
2. **The keyboard path is real, complete and visible.** `1–3` select, arrows move, `Enter` drops, `Escape` cancels; the footprint is drawn as a dashed accent box. Proven by screenshot A/B diff: 2,022 changed sample points, bbox `(623,202)–(803,474)` = cells x 2–3, y 2–4, exactly matching the scripted input.
3. **Layered, mechanic-keyed feedback — no turn is mute.** Sound differentiates every event; visuals add settle, floater, pop, slot state, progress. This is precisely the defect the first critique found, and it is genuinely closed (score deltas `14 → 22 → 28` confirmed for 4/3/3-block placements).

---

## Priority Issues

### [P0] The HUD drifts over the board's top row on short phones
- **What:** `HUD_TOP_GUTTER = 78` is a hardcoded constant, but the mobile HUD wraps to two rows and is 123–146px tall. **Independently re-verified in the parent context:** at 360×640 the HUD bottom is 133px while the board starts at 108px (**25px overlap**); at 320×568, bottom 156 vs top 98 (**58px overlap** — covers row 0 and part of row 1). Assessment A measured rows (2,0)–(5,0) as 100% covered at 360×640. The panel is `rgba(31,24,20,0.92)` with an 8px blur, and `#hud` is `pointer-events: none`, so **those cells stay tappable while invisible**.
- **Why it matters:** The board resets empty every level, so this is the default state of play on iPhone-SE-class devices — the first placement can land in a cell the player cannot see. 390×844 is unaffected, which is why casual testing misses it.
- **Fix:** measure, don't guess — read `hud.getBoundingClientRect().height` in `resize()`, pass it into `computeLayout`, and set `gutterY = Math.max(78, hudHeight + 8)`. Add a regression check at 360×640.
- **Suggested command:** `/impeccable layout` (or `/impeccable adapt`)

### [P1] The loss arrives with no warning — and nothing can be taken back
- **What:** every placement is irreversible, `endGame()` fires inside the same `commitMove` that discovers no placement remains, and there is no undo, hold, or pause. The panel explains nothing ("No entraba ninguna pieza más.") and never names the blocking piece. Reaching game over took deliberately adversarial play: 17 moves, ended at level 4 with zero warning.
- **Why it matters:** The genre's engine is the board filling up, and here the ending is both unreachable in normal play and unteachable when it lands — pure negative feedback with no attribution.
- **Fix:** detect the cliff (`if a remaining piece has ≤2 legal origins`, pulse the HUD panel + a distinct cue); expose one undo (or a hand-swap on cooldown); and have the game-over panel name the trap ("no entraba el `3x1`").
- **Suggested command:** `/impeccable onboard` (first-run/teachable states) with `/impeccable clarify` for the copy

### [P1] The end-of-run card is typographically the title screen
- **What:** `nivel 1 listo` and `se acabó` both render 48px/800 in `--accent`, inside the same 440px card with the same 16px/14px body — the visual twin of the `blockblast` wordmark. Compounding it, the panel's `626 pts` (level) and the HUD's `PUNTOS 2150` (run) are both on screen labelled only "pts".
- **Why it matters:** The emotional payoff reads as the front door, and the two contradictory totals make the score feel arbitrary exactly when the player is deciding whether to go again.
- **Fix:** give result states their own scale — a 13px letterspaced uppercase micro-label over a large *number* that is the achievement — and label the two figures explicitly (`nivel` vs `total`).
- **Suggested command:** `/impeccable typeset`

### [P2] The modal doesn't own the screen, and its veil is the wrong colour
- **What:** (a) `.back` and `#sound` are `z-index: 20`; `#overlay` is `z-index: 10` — verified in the rendered PNG at ratio 1.00 vs the veiled background, and `elementFromPoint` returns them above the overlay while it is open, so chrome floats lit above every modal and stays clickable; (b) focus never enters the dialog and `aria-modal` is absent; (c) **the veil is still the old cold `rgba(6,8,14,0.76)` (style.css line 192)**, which measurably inverts the warm palette behind every modal.
- **Why it matters:** The "modal" looks and behaves like a non-modal overlay that happened to dim the canvas, and the one surface that should feel like part of the warm world is the coldest thing on screen.
- **Fix:** pick one contract and hold it — either raise the overlay above the chrome, move focus to `#play` on open, and add `aria-modal="true`; or keep the corners reachable and stop treating it as modal. Either way, derive the veil from `--bg` (e.g. `rgba(20,13,8,0.76)`).
- **Suggested command:** `/impeccable polish`

### [P2] Reduced motion misses the record celebration
- **What:** `flashResult()` applies `beat` to `#overlay-result`, but the `prefers-reduced-motion` block (style.css line 462) disables `#best.beat` — the HUD span, which never receives the class. Verified with the media feature active: `#overlay-result.beat` still computes `animationName: pop`, `0.6s`.
- **Why it matters:** Motion-sensitive players still get the scale-and-snap on the game's biggest emotional beat, and the guard looks present while doing nothing.
- **Fix:** change the selector to `.result.beat` (or just `.beat`).
- **Suggested command:** `/impeccable polish`

---

## Persona Red Flags

**Jordan (first-timer)**
- Six metrics appear the instant you press Jugar; three are never explained anywhere.
- `LÍNEA` is a bare `8` with no unit — indistinguishable from "lines cleared".
- The one strategic rule (`La mano se repone entera cuando la vaciás.`) is the last line of the intro at 12px muted, and is gone forever after one press.
- On a 375×667 phone, half the first board row is invisible, so the first placement can land in a cell they cannot see.

**Casey (mobile)**
- 360×640: cells (2,0)–(5,0) 100% behind the HUD; at 320×568 the HUD also eats ~30px of row 1.
- Tray slots 42.6px (360) / 33.3px (320) tall — under the 44px target the same stylesheet enforces on `.back`/`#sound`; the pieces inside are 9.9px / 7.7px blocks.
- `pointerLift` is a fixed `cell * 1.2`, so at 32px cells a finger still blankets 2+ cells.
- No undo, so one fat-finger misdrop into a 32px cell is permanent.

**Alex (power user)**
- Keyboard works but is thin: no key to cycle pieces (must recall the digit), no centroid snap, no shortcut to redraw the hand; `Escape` works but isn't in the documented key list.
- No undo, hold, pause, or way to clear the persisted level.
- At level clear, two contradictory totals are on screen (`626 pts` panel vs `PUNTOS 2150` HUD).
- Losing resets to level 1 while `blockblast.level` keeps the high-water mark — "Otra vez" and a page reload disagree about where the player belongs.

---

## Minor Observations

- **The toast covers the tray on desktop.** `#toast` rests at y 837–870; tray slots end at y 849.8 — `"¡mano completa! +60"` overlaps the bottom ~12px of slots 0 and 1 at the exact moment the tray content changes. Mobile is fine.
- `board.ts`'s `hasLinePlacement()` is never called; `levels.ts`'s `seedForLevel()` is exported but unused (the tray uses `Math.random`), so levels are **not** deterministic despite the module comment promising they are.
- The intro card is centred on the viewport (centre 720) while the board is centred at 806 — an ~86px mismatch between the card and the thing it describes.
- No `aria-live` region for score/level/combo (the toast has `role="status"`, but the numbers aren't announced), and the tray has no non-visual representation.
- `sips`-based image decode works; `vision` does not, in this session.
- Only network error is a `favicon.ico` 404; no JS exceptions across a full run to game over.
- The portal badges blockblast in `#7fd4ff` (the game's blue block) while the game's own chrome is `#ffb454` (amber) — the identity is subtly forked across surfaces.

---

## Questions to Consider

1. If the board resets empty every level and level 1 completes in six moves, what are levels actually for? The genre's engine is the board filling up; as shipped, the game spends its life in the first third of that curve and the loss is nearly unreachable. Would it be a better game as one continuous run with a rising target, and "level" demoted to a milestone flourish?
2. The line-clear preview is the brightest element in the whole product — in a palette that contains no white. Should the strongest signal serve the reward (this will clear) or the risk (this will corner you)? Right now the game shouts about clears and whispers about traps.
3. The portal tints this game blue (`#7fd4ff`); the game's own chrome is amber (`#ffb454`). Which one is this game's colour — and what is the rule that decides which one the next surface (record screen, share card, portal tag) should use?

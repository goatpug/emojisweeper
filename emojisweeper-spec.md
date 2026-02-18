# Emojisweeper — Game Design Specification

## Overview

Emojisweeper is a browser-based game inspired by Mamono Sweeper (hojamaka.com). It's a Minesweeper variant with RPG leveling mechanics where players reveal tiles, sweep leveled emojis, gain XP, level up, and clear the board. The game should be fully playable on both desktop and mobile browsers.

## Core Concept

Like Minesweeper, the board is a grid of hidden tiles. Unlike Minesweeper:
- Hidden tiles contain **leveled emojis** (not just bombs) — small ones like 🍒 at level 1, large ones like 🍉 at level 5
- You **must** reveal all tiles to win (you can't just avoid emojis)
- You have **HP** and can survive some bad clicks
- You have a **player level** that increases as you gain XP
- Numbers on revealed safe tiles show the **sum of all adjacent emoji levels** (not just a count)
- Clicking an emoji **at or below your level** sweeps it safely and earns XP
- Clicking an emoji **above your level** deals damage or overwhelms you

### Terminology
- **Sweep**: Successfully collecting an emoji. The player "sweeps" emojis off the board.
- **Emoji**: What's hidden under tiles. Each has a level/size (level 1 = smallest, level 5 or 9 = largest).
- **Level**: The player's current power level, determining which emojis can be safely swept.

## Difficulty Levels

### Easy
- Grid: 16 rows × 16 columns
- Starting HP: 30
- Emoji levels 1–5
- Emoji counts: Lv1 ×10, Lv2 ×8, Lv3 ×6, Lv4 ×4, Lv5 ×2
- Total emojis: 30 (out of 256 tiles)

### Normal
- Grid: 16 rows × 30 columns
- Starting HP: 10
- Emoji levels 1–5
- Emoji counts: Lv1 ×33, Lv2 ×27, Lv3 ×20, Lv4 ×13, Lv5 ×6
- Total emojis: 99 (out of 480 tiles)

### Huge
- Grid: 25 rows × 50 columns
- Starting HP: 30
- Emoji levels 1–9
- Emoji counts: Lv1 ×52, Lv2 ×46, Lv3 ×40, Lv4 ×36, Lv5 ×30, Lv6 ×24, Lv7 ×18, Lv8 ×13, Lv9 ×1
- Total emojis: 260 (out of 1250 tiles)

## Player Leveling & XP System

### XP Earned Per Sweep
XP earned = 2^(emoji_level - 1)

| Emoji Level | XP Earned |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 4 |
| 4 | 8 |
| 5 | 16 |
| 6 | 32 |
| 7 | 64 |
| 8 | 128 |
| 9 | 256 |

### Leveling Up
The player starts at Level 1. To advance to the next level, the player must accumulate enough XP to reach the threshold for that level. XP required for each level needs to be calibrated so that:
- Levels 1→2 and 2→3: The player levels up naturally by sweeping enough emojis at or below their current level. They do NOT need to clear all emojis of any specific level.
- **Gate mechanic**: At a certain point (level 3→4 on Easy/Normal with 5 emoji levels; level 5→6 on Huge with 9 emoji levels), the player must have swept ALL emojis at or below the gate level before they can advance. This is a solvability constraint — without it, the number clues become too ambiguous when low-level and high-level unknowns are mixed together.
- After the gate: Leveling continues normally without requiring complete clears.

### UI Explanation of the Gate
The gate mechanic should be clearly communicated to the player. When they're approaching the gate level, show a message like: "Clear all remaining Level 1–3 emojis to unlock Level 4" with a progress indicator. This should not feel like a surprise — it should feel like a natural checkpoint.

## Damage System

When a player clicks an emoji above their level:

**damage = 5 × 2^max(0, level_difference - 2)**

Where level_difference = emoji_level - player_level

| Level Difference | Damage |
|---|---|
| 1 | 5 |
| 2 | 5 |
| 3 | 10 |
| 4 | 20 |
| 5+ | Instant death 💀 |

When a player clicks an emoji at or below their level: no damage, emoji is swept, XP is earned.

## First Click Safety

The very first click of each game is **guaranteed safe** — it must reveal a non-emoji tile. If the randomly generated board would place an emoji on the first-clicked tile, regenerate or relocate that emoji before revealing.

## Number Clues

When a safe (non-emoji) tile is revealed, it displays a number equal to the **sum of all adjacent emoji levels** (including diagonals — up to 8 neighbors). A "0" means no adjacent emojis; these should auto-reveal neighbors recursively (like Minesweeper's flood fill for zeros).

Example: If a tile is adjacent to one Level 3 emoji and two Level 1 emojis, it displays "5".

This is the key strategic difference from Minesweeper — a "5" could mean many different combinations of emojis, and the player must use surrounding information to deduce what's there.

Revealed emoji tiles may also be tapped to display the sum of adjacent emoji levels. Tapping the tile again displays the revealed emoji.

## Emoji Theming

Emojis are displayed, ordered from smallest to largest.

### Default Theme: Fruit (for Easy/Normal, 5 levels)
🍒 🍏 🍌 🍍 🍉

### Additional 5-Level Themes
- Birds: 🐤 🦜 🦅 🐧 🦩
- Animals: 🐒 🐅 🦍 🦒 🐘

### 9-Level Theme (for Huge)
A mix of animals ordered by size with color variety. To be determined — but should follow the same principle of escalating size/intensity.

### Future Feature: Custom Emoji Picker
Eventually allow players to choose their own emoji set. Not needed for v1.

## UI Layout

### Top Bar — Player Stats
Display clearly (no cryptic abbreviations):
- **HP**: Current / Max (e.g., "HP: 25 / 30") — consider a visual health bar
- **Level**: Current player level, prominently displayed with the **current-level emoji** shown large and obvious
- **XP**: Current XP / XP needed for next level (e.g., "XP: 7 / 10") — consider a progress bar
- **Time**: Elapsed time (pauses when game is paused)
- **Pause button**

When the player **levels up**:
- The emoji in the level display changes to the next emoji — this should be visually prominent and unmissable
- Show a toast notification: "Level Up! 🍌→🍍" (or whatever the transition is)
- Brief visual flourish (CSS animation — scale up, glow, etc.)

### Main Area — The Grid
- Unrevealed tiles should be visually distinct (raised/colored)
- Revealed safe tiles show their number
- Swept emojis show their icon
- Flagged/marked tiles show the player's guess

### Bottom Bar — Emoji Legend
Show each emoji level with:
- The emoji for that level
- How many of that level remain unfound
- Visual indicator of which levels are safe to click (at or below player level) vs dangerous

This also serves as the **mobile marking interface** (see Controls below).

## Controls

### Revealing Tiles
- **Desktop**: Left-click
- **Mobile**: Tap

### Marking/Flagging (Guessing what's under a tile)

**Mobile**:
1. Tap an emoji level in the bottom legend bar — it gets a green highlight to show it's selected
2. Tap a tile on the grid — it gets marked with that level number
3. The level auto-deselects after marking
4. The game prevents you from revealing tiles you've marked with a level higher than your current level (safety feature!)

**Desktop**:
- **Hover + number key**: Hover over a tile and press a number key to mark it with that level
- **Right-click**: Opens a small popup showing all levels higher than your current level; click one to mark. This replaces the clunky "right-click cycles through numbers" from Mamono Sweeper.
- Marked tiles can be cleared by right-clicking and selecting "clear" or pressing 0/Delete

### Pause
- Pause button in the top bar
- When paused: the grid is **hidden** (replaced with blank/covered tiles or a solid overlay) with "PAUSED" text centered. This prevents studying the board for free.
- Timer stops while paused

## Scoring & High Scores

Track **personal bests** for each difficulty level. For each completed game, record:
- **Time**: Total elapsed time (excluding paused time)
- **Clicks**: Total number of tile reveals (fewer = more efficient)
- **Damage Taken**: Total HP lost during the game (lower = cleaner run)

### High Score Display
- Show a table of personal bests per difficulty
- Let the user **sort by** whichever metric they care about (time, clicks, or damage)
- Store in browser localStorage

## Game States

1. **New Game**: Grid is fully covered, stats are at starting values, timer hasn't started
2. **Playing**: Timer running, player is revealing tiles
3. **Paused**: Timer stopped, grid hidden
4. **Won**: All tiles revealed, all emojis swept — show completion stats and check for new personal bests
5. **Game Over**: Player died (instant death or HP reached 0) — show which emoji got them, reveal the full board

## Visual Design Notes

- Clean, modern look — NOT retro pixel art
- The grid should be the focal point
- Numbers on revealed tiles should be color-coded by value (like Minesweeper uses different colors for 1, 2, 3, etc.) — but since our numbers can be much higher, use a gradient or color scale
- Responsive design: playable on phone screens (the grid may need to scroll on smaller screens for larger difficulties, that's fine)
- Consider a dark mode / light mode toggle (future feature, not v1)

## Technical Notes

- Pure client-side web app (HTML/CSS/JavaScript or React)
- No server needed
- High scores stored in localStorage
- Should work in all modern browsers
- Mobile-first responsive design
- Sound effects to be added later (Web Audio API)

## Future Features (Not V1)
- Allow user to sweep all marked tiles of a certain level
- Custom emoji picker
- Sound effects
- Dark/light mode toggle
- Additional emoji themes
- Undo last move (costs HP?)
- Seed-based boards for sharing specific puzzles

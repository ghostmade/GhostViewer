# GhostViewer — UI/UX redesign proposal

**Backup of v1.25 saved at:** `design-backup-v1.25/` (contains `player.html`, `popup.html`, `i18n.js`).

This doc summarises what current 2026 design research says, then proposes
**three concrete directions** to redesign GhostViewer's UI. Pick one (or
mix elements), and I'll implement it next.

---

## What the research says (relevant findings only)

From Tubik Studio's [7 UI Design Trends of 2026](https://blog.tubikstudio.com/ui-design-trends-2026/),
[Smashing Magazine on streaming interfaces](https://www.smashingmagazine.com/2026/04/designing-stable-interfaces-streaming-content/),
and YouTube/Twitch redesign coverage:

1. **"Anti-liquid glass" — function over spectacle.** The 2025 trend of glassmorphism (backdrop-filter blur) has reversed: dark UIs are moving back to **solid semi-transparent backgrounds** because blur kills contrast. *We currently use blur on the floating fullscreen bars — should drop it.*
2. **Purposeful motion only.** Animation should communicate state, not decorate. Brief confirm-pulses on state changes; no bouncy hovers.
3. **Monospaced typography for technical data.** Timestamps, FPS, bitrate, latency read better in mono. *Our stats panel uses sans — could be improved.*
4. **`prefers-reduced-motion` is non-negotiable.** Users with vestibular sensitivity. *We currently don't honour it.*
5. **Fluid type with `clamp()`** — chat font size scales with viewport.
6. **Empty states matter.** Bare "No channels added yet" with no guidance is a wasted opportunity to teach the feature.
7. **Predictive visibility.** Controls appear when needed, fade when not. *Already implemented for fullscreen.*
8. **Focus rings (`:focus-visible`).** Keyboard navigation needs visible focus indication for accessibility. *We currently have none.*
9. **Bolder typography hierarchy** — oversized headings against neutral bodies. Confident, minimalist feel.
10. **Subtle gradients > flat fields** for surface hierarchy (header vs body vs sidebar).

---

## Direction A — "Refined Twitch" (minimal evolution)

**Identity:** Same purple-and-dark identity as today, just sharper and more accessible. Lowest risk; quick win. **Recommended if you don't want to change the brand at all, just polish.**

### Visual changes
- **Drop the backdrop-filter blur** on fullscreen bars; switch to `rgba(14,14,16,0.94)` solid translucent.
- **Add `:focus-visible` rings** (2px purple outline, offset 2px) to all interactive elements.
- **Monospace** font stack for stats panel values, timestamps in chat, bitrate display: `ui-monospace, "JetBrains Mono", "Cascadia Code", Consolas, monospace`.
- **Honour `prefers-reduced-motion`** — disable transitions and chat animations when set.
- **Better empty state** in popup — small illustration (we can use the ghost emoji at large size with helper text underneath).
- **Tighter spacing rhythm** — adopt a 4px scale: 4 / 8 / 12 / 16 / 24 / 32. Today's spacing is mixed (5/6/7/9/10/11/14).
- **Subtle hover lift** on chat emote (transform: scale(1.08) on hover), not on every button (kills the bouncy decoration trend).

### What stays
- Layout (40px topbar / 1fr / 36px controls grid).
- Color palette (#0e0e10 base, #bf94ff purple accent, #53fc18 Kick green).
- Icon library (Material-style filled).
- Typography hierarchy.

### Effort: ~1 hour. Risk: very low.

---

## Direction B — "Operational" (the raw/schematic aesthetic)

**Identity:** A power-user tool. Monospaced everywhere. Hairline borders. Less rounded. Reads like a piece of broadcast equipment. **Recommended if you want GhostViewer to feel distinct from Twitch/Kick rather than like a clone of them.**

### Visual changes
- **Monospaced everywhere** — chat, controls, popup, topbar. `ui-monospace`-stacked.
- **Hairline borders** (`1px solid rgba(255,255,255,0.06)`) replacing solid surface fills as the primary structural device.
- **Less corner rounding** — 4px → 2px on most surfaces; 0px on dividers.
- **Reduced color** — drop the heavy use of purple/green for fills; restrict accents to focus rings, "active" states, and brand badges only.
- **Brand-mark in topbar** — a subtle uppercase "GHOSTVIEWER" wordmark in monospace, replacing the bare ghost emoji.
- **Stat readout panel** — like a piece of monitoring equipment: `RES 1920×1080`  `FPS 60`  `BR 6500K`  `BUF 2.4s` in horizontal monospace bar at the bottom of the video instead of tucked in a corner.
- **Channel list in popup** uses an outlined-row look with monospace channel names: `[•] xqc` / `[•] hasanabi`.

### What stays
- Color base (#0e0e10).
- Layout.

### Effort: ~3-4 hours. Risk: medium — it's a real visual change. Some users will love the look, others will find it cold.

### Sample preview (popup-style ASCII)

```
GHOSTVIEWER ·····················
···································
TWITCH        ┌──────────────────┐
              │ channel or url   │ +
              └──────────────────┘
              ●  xqc           ✕
              ●  hasanabi      ✕
              ●  kaicenat      ✕
···································
KICK          ┌──────────────────┐
              │ channel or url   │ +
              └──────────────────┘
              · no channels
···································
[ ] notify when ghosted streamer goes live

· · · only listed channels are affected
```

---

## Direction C — "Streaming-native" (premium / Twitch-2025-redesign-coded)

**Identity:** What GhostViewer would look like if Twitch's design team built it. Bolder typography, more breathing room, stronger hierarchy, premium feel. **Recommended if you want the extension to feel like a polished consumer product first.**

### Visual changes
- **Bolder typography hierarchy** — channel name in topbar grows to 16px / weight 800 (currently 14/700). "GhostViewer" wordmark in popup at 18px / 800.
- **Subtle vertical gradient** on the topbar surface (`linear-gradient(180deg, #1a1a1f 0%, #18181b 100%)`) — adds depth without being decorative.
- **Larger control buttons in fullscreen** — currently controls feel cramped at 36px row height. Floating fullscreen bar grows to 48px with 11px → 12px text.
- **Bigger emote previews** in tooltip (was 96px, → 128px).
- **Pill-shaped status badges** — Live dot becomes "● LIVE" pill; "VOD" becomes a proper "VOD" pill; "Ghost Mode" becomes a rounded pill in subtle purple.
- **Chat header redesign** — channel viewer count shifted to a more prominent 👁 X.XK pill next to "Chat" title.
- **Better empty state in popup** — large ghost emoji centered, "Add a Twitch or Kick channel above to start ghost-watching." helper line, "How does this work?" link to a brief explainer.
- **Notification toggle gets a real switch** — replace the OS checkbox with a custom iOS-style switch.

### What stays
- Monochrome dark base + Twitch purple / Kick green identity.
- Grid layout.

### Effort: ~4-5 hours. Risk: medium — biggest visual departure from current; could feel "over-designed" if not careful.

### Sample preview

```
👻 GhostViewer            ┃ ● LIVE  evojapan      [👁 12.4K]      Ghost Mode
───────────────────────────────────────────────────────────────────────────
                                                              ┃   CHAT
                                                              ┃   shlomo15:
                                                              ┃     [emote]
                                                              ┃   wertyloo:
                  [video]                                     ┃     PogChamp
                                                              ┃   …
                                                              ┃
───────────────────────────────────────────────────────────────────────────
   🔇 Mute  ▬▬▬●▬▬▬   ⊞ Fit   ⧉ PiP   📊 Stats   💬 Chat   ↻ Refresh   ⛶ Fullscreen
```

---

## Cross-cutting improvements (apply to whichever direction you pick)

Regardless of which direction you choose, these are universally good and I'd include them:

- ✅ **Drop `backdrop-filter: blur`** on fullscreen overlays (move to solid translucent).
- ✅ **`prefers-reduced-motion` support** — kill animations for users who opt out.
- ✅ **`:focus-visible` rings** on all interactive elements.
- ✅ **Monospace** for stats panel values (RES/FPS/BR/BUF/Lat) — improves scanning.
- ✅ **Better popup empty state** — beyond just "No channels added yet".
- ✅ **Consistent 4px spacing scale** — current spacing is ad-hoc.
- ✅ **`aria-label` audit** — buttons with only icons need aria-labels.
- ✅ **Focus trap inside the chat tooltip** — currently it could steal keyboard focus from the player.

---

## Playwright testing — three options

You asked about Playwright. For a Chrome extension, three feasibility tiers:

| Option | What it does | Effort | Verdict |
|---|---|---|---|
| **(1) Manual screenshot diff** | I take screenshots of the v1.25 backup, then v1.26 after redesign. Side-by-side comparison. | 15 min | **Recommended** for design comparisons. |
| **(2) Playwright happy-path** | Set up Playwright with Chromium + `--load-extension` flag. Smoke test: open popup, add a channel, verify list renders. | 2-3 hours, adds `package.json` + node_modules. | Good for catching regressions on each release. |
| **(3) Full Playwright test suite** | Cover every feature: notifications, chat connection, fullscreen, etc. Many tests need network mocking (Twitch GQL, Pusher, etc.). | 1-2 days. | Overkill for an extension at this stage. |

Recommendation: **(1) for this redesign, (2) only if you plan to add features regularly and want regression safety.**

---

## How to choose

If you want me to suggest one: **Direction A + all the cross-cutting improvements**. It's the lowest-risk path to a noticeably better UI without changing the brand. Direction B (Operational) is the most distinctive but a bigger swing. Direction C (Streaming-native) is the most polished but takes the longest and is closest to looking like a Twitch clone.

Tell me:
1. Which direction (A / B / C) — or "mix X with Y" — and any specifics you want changed.
2. Whether to set up Playwright (option 2 above) or just do screenshot comparison.

I'll then bump to v1.26, implement, and produce a side-by-side comparison.

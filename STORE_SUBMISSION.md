# Store submission guide — Chrome & Firefox

Written for v1.32. End-to-end: GitHub repo → privacy URL → Chrome Web Store → Firefox AMO.

**Working directory:** `c:\VSCodeProjects\GhostViewer`
**Release zip:** `C:\Users\Oskar\Downloads\GhostViewer-1.32.zip`

---

## Phase 0 — Prerequisites checklist

- [ ] GitHub account created
- [ ] [GITHUB_SETUP.md](GITHUB_SETUP.md) followed: repo created, code pushed, LICENSE picked
- [ ] Public privacy-policy URL working (e.g. `https://github.com/<you>/GhostViewer/blob/main/PRIVACY_POLICY.md`)
- [ ] **3-5 screenshots** of the extension at 1280×800 or 640×400 (see "Taking screenshots" below)
- [ ] **Promo tile** at 440×280 (optional but boosts discoverability)
- [ ] $5 USD ready for the Chrome Web Store one-time developer fee
- [ ] Firefox account (free) for AMO

---

## Phase 1 — Privacy policy URL setup

Already mostly done if you followed [GITHUB_SETUP.md](GITHUB_SETUP.md). Recap of the simplest path:

```
https://github.com/<your-username>/GhostViewer/blob/main/PRIVACY_POLICY.md
```

**Open it in an incognito window** to confirm it's publicly viewable without login. Both stores' reviewers will follow this link.

If you preferred GitHub Pages instead, the URL is:
```
https://<your-username>.github.io/GhostViewer/PRIVACY_POLICY
```

Either works. The blob URL is one less moving part.

---

## Phase 2 — Taking screenshots

Both stores want screenshots. Use these scenes (Chrome at 1280×800, scaled if needed):

1. **Popup with channels added** — open the popup with 3-4 channels of each platform listed; flick the "Notify me when a ghosted streamer goes live" switch on for the screenshot so it's discoverable.
2. **Player page with stream + chat** — pick a live stream you'd genuinely watch; chat panel visible with a few messages.
3. **Player in fullscreen** — show the floating overlay controls. Move the mouse first so they're visible (otherwise auto-hide will kick in).
4. **Stats overlay open** — toggle the stats panel and capture it over the video.
5. **Emote hover tooltip** — bonus shot showing the 4× emote preview.

**How to take them on Windows:**

```
Win + Shift + S → Rectangle snip → save as PNG
```

Crop to exactly **1280×800** (Chrome's preferred large size) using any image editor. Save as PNG. Both stores accept PNG and JPEG.

---

## Phase 3 — Chrome Web Store submission

### 3a. Pay the developer fee (one time, ~5 min)

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Sign in with the Google account you want to publish under.
3. Pay $5 USD via the prompt. **Read the prompt carefully** — the account-name field on this page determines your "publisher name" shown in the store. You can change it later, but it's easier to set correctly now.
4. Wait for confirmation email.

### 3b. Create a new item (~30 min)

1. Dashboard → **New item** → upload `GhostViewer-1.32.zip`.
2. The dashboard auto-extracts the manifest. Wait for the upload to finish.

### 3c. Fill the **Store listing** tab

- **Description (long)** → paste the long description from [STORE_LISTING.md](STORE_LISTING.md). Replace the two placeholders (`<PASTE PRIVACY POLICY URL>` and `<PASTE GITHUB URL>`) with your real URLs.
- **Category** → **Entertainment** (per the listing doc).
- **Language** → **English (United States)** as primary. We have `_locales/en` and `_locales/pl` — Chrome detects locales automatically; you do not list them separately here.
- **Screenshots** → upload all 3-5 PNGs from Phase 2.
- **Promotional tile (440×280)** → upload if you made one. Skip if not — it's optional.
- **Marquee tile (1400×560)** → optional. Skip.
- **Single purpose description** → "A privacy-first viewer for Twitch and Kick streams." (literally one sentence.)

### 3d. Fill the **Privacy practices** tab

This is where most rejections happen. Be exact.

- **Single purpose** → repeat the one-sentence description.
- For each requested permission, pick the closest **justification** option and add a 1-2 sentence explanation:
  - `declarativeNetRequestWithHostAccess` → "Adjusts Referer/Origin headers on direct CDN requests so the public stream manifest loads, and blocks the platform's tracking endpoints (e.g. spade.twitch.tv, tracking.kick.com)."
  - `webNavigation` → "Detects when the user navigates to a Twitch or Kick channel they've added to their ghost list, so the extension can redirect them to the built-in private player."
  - `tabs` → "Reads tab URLs to detect when a player tab is open (notification suppression) or closed (notification cooldown)."
  - `storage` → "Stores the user's channel list and player preferences locally."
  - `alarms` → "Schedules the periodic live-status check used by the optional notifications feature."
  - `notifications` → "Shows a desktop notification when a ghost-listed streamer goes live (only if the user has enabled this feature)."
  - **Host permissions** → "Required to fetch stream manifests, chat messages, and emote metadata directly from the listed Twitch, Kick, and 7TV endpoints. The extension does not write to or modify any third-party site."
- **Remote code use** → **No**. (We bundle hls.min.js; we don't load any remote code.)
- **Data collection / handling** → check **"This developer does not collect or use any of the data listed above"** — true for us.
- **Privacy policy URL** → paste the URL from Phase 1.

### 3e. Fill the **Distribution** tab

- **Visibility** → **Public**.
- **Distribution** → "All regions" unless you have a reason to exclude any.
- **Pricing** → Free.

### 3f. Submit for review

- Click **Submit for review** at the top.
- Review takes **1-7 days typically**, occasionally longer.
- You'll get an email when it's approved (or rejected with a reason).

### 3g. If Chrome rejects

The most common reasons for an extension like ours:

- **"Use of permissions"** — usually means the justifications are too vague. Make them more specific, list the exact endpoints and what's read.
- **"Single purpose policy"** — phrase the description as a single coherent purpose, not a feature list.
- **"Browser circumvention"** — if they classify GhostViewer as a Twitch ad-blocker. Reply with: "GhostViewer is a private viewing tool that uses public APIs the same way the official Twitch/Kick web players do. It does not circumvent ad-serving — it accesses the public HLS stream manifest path that already exists for embeds."

Reviewer responses come within 1-2 days; you can resubmit unlimited times for free.

---

## Phase 4 — Firefox AMO submission

Firefox is more permissive than Chrome and has no upfront fee. Worth doing as a fallback in case Chrome ever pulls the extension.

### 4a. Create AMO account (~5 min)

1. Go to <https://addons.mozilla.org/developers/>.
2. Sign in with your Firefox account (create one if needed — separate from Mozilla account systems can vary).

### 4b. Submit a new listing (~20 min)

1. Click **Submit a New Add-on**.
2. Choose **On this site** (= listed publicly on AMO).
3. **Distribution** → "On AMO".
4. Upload `GhostViewer-1.32.zip`.
5. AMO will validate — this should pass cleanly. If it warns about minified `hls.min.js`, see "AMO source code" below.
6. Wait for the auto-signing step (~30 seconds).

### 4c. Fill the listing form

- **Name** → "GhostViewer 👻" (or just "GhostViewer" if you'd rather skip the emoji)
- **Add-on URL** → leave default
- **Summary** → use the short summary from [STORE_LISTING.md](STORE_LISTING.md)
- **Description** → use the long description from STORE_LISTING.md (same content as Chrome)
- **Categories** → Entertainment (under "User interface" if asked)
- **License** → match what you picked for the GitHub LICENSE file (MIT recommended)
- **Privacy Policy** → paste the same URL as Chrome
- **Screenshots** → upload the same 3-5 PNGs

### 4d. AMO source code requirement (one-time annoying step)

Because `hls.min.js` is minified, AMO requires you to provide the source code. You have two options:

**Option A (recommended): point to the upstream source**
- In the "Source code" field on AMO, paste:
  ```
  hls.min.js is a minified build of hls.js v1.x.
  Source: https://github.com/video-dev/hls.js
  Specific build: https://github.com/video-dev/hls.js/releases (the corresponding minified file from a published release)
  No source modifications were made.
  ```

**Option B (cleaner): swap to the unminified version**
- Download the unminified `hls.js` from the same release on GitHub.
- Rename it to `hls.js`, replace `hls.min.js` in your project, update the script tag in `player.html`.
- File size goes from ~412KB → ~1.4MB. Most users won't notice.
- No source-code form needed.

Option A is faster; Option B is "more honest" per AMO's spirit but slower to load.

### 4e. Submit

- Submit the listing.
- Review timeline: 1-14 days.
- Auto-signing means even before AMO listing approval, the XPI is signed and could be distributed manually.

---

## Phase 5 — Post-submission

### Tracking
Both stores email you on approval/rejection. Add the dashboard URLs to your bookmarks:

- Chrome: <https://chrome.google.com/webstore/devconsole>
- Firefox: <https://addons.mozilla.org/developers/>

### Versioning future releases

Each new version needs:
1. Bump `version` in `manifest.json`
2. Build the zip (existing PowerShell command)
3. Upload to **both** dashboards (no auto-sync)
4. **Chrome:** Same review process. Review of updates is usually faster (1-3 days).
5. **Firefox:** Same.

### Statistics

Both stores expose install counts, weekly active users, ratings:
- Chrome dashboard → "Stats" tab
- AMO dashboard → "Statistics"

These take ~24h to populate after launch.

---

## Phase 6 — Edge cases & gotchas

- **Chrome may ask for "browser circumvention" justification.** Have the response ready: GhostViewer uses publicly-documented HLS manifest endpoints, the same ones the official web embed uses. It's a different *playback path*, not a *circumvention*.
- **Don't talk about ad-blocking anywhere in the listing.** The framing throughout the listing doc is privacy-first for a reason. Even mentioning "no ads" raises classification flags.
- **If Chrome eventually pulls the extension**, the Firefox listing keeps working. This is the main reason to ship to both.
- **The `browser_specific_settings.gecko` block in manifest** is correct — both stores accept it (Chrome ignores, Firefox uses).

---

## TL;DR — fastest path to live

If you have everything ready:

1. Push the GitHub repo (15 min — see [GITHUB_SETUP.md](GITHUB_SETUP.md))
2. Take screenshots (15 min)
3. Pay Chrome's $5 fee (5 min)
4. Fill Chrome dashboard form (30 min)
5. Submit Chrome (3 min) → wait 1-7 days
6. (Parallel) Submit Firefox (20 min) → wait 1-14 days

Total active time: ~90 minutes.

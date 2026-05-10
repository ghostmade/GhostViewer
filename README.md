# GhostViewer 👻

> Watch Twitch and Kick streams without being counted as a viewer or seeing ads.

GhostViewer is a Chrome / Firefox extension that redirects channels you've added to a "ghost list" into a built-in HLS player. Because the player fetches the public stream manifest directly, your visit doesn't:

- count toward the streamer's viewer count
- load any Twitch / Kick ads
- send tracking pings to the platform
- require you to sign in to anything

A persistent **Ghost Mode** indicator stays visible while you watch so you always know it's active.

---

## Features

- **Twitch and Kick** support — both live streams and VODs
- **Live chat overlay**
  - Twitch: anonymous IRC read-only (no login)
  - Kick: Pusher WebSocket (no login)
- **7TV emote** support, plus native Twitch and Kick emotes
- **Hover any emote** for a 4× preview and source badge
- **Optional desktop notifications** when a ghost-listed streamer goes live
  - Per-channel mute via bell icon
  - Off by default; opt in from the popup
  - 4-hour cooldown after closing a watched stream so you don't get re-pinged immediately
- **Stream stats overlay** (resolution, FPS, bitrate, buffer, dropped frames, latency)
- **Quality picker** (Auto + every level the stream offers)
- **Picture-in-Picture**
- **Fullscreen** with floating, auto-hiding controls
- **Resizable chat panel** + persistent settings (volume, font size, width)
- **Chat history** preserved when toggling the chat panel off and on
- **Auto-reconnect** when a stream goes offline mid-watch
- **Web Audio volume** with perceptual curve and 1.5× boost above native max
- **Keyboard shortcuts:** `m` mute · `f` fullscreen · `c` chat · `t` timestamps · `s` stats · `+`/`-` chat font · `space` play/pause
- **Internationalised** — English and Polish included

## How it works

1. Click the GhostViewer icon and add a Twitch or Kick channel name to your ghost list.
2. Visit `twitch.tv/<channel>` or `kick.com/<channel>` as you normally would. GhostViewer detects the navigation and replaces the page with its built-in player.
3. Channels not on your list load normally.

## Privacy

- Channel list and settings are stored locally (`chrome.storage.local`). Nothing is uploaded.
- No analytics, no telemetry, no tracking.
- Endpoints contacted: `gql.twitch.tv`, `*.ttvnw.net`, `*.live-video.net`, `kick.com`, `7tv.io`, `cdn.7tv.app`, `static-cdn.jtvnw.net`, `irc-ws.chat.twitch.tv`, `ws-us2.pusher.com`.
- Full policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

## Ethical use

GhostViewer is a **personal viewing tool**. It exists for users who want to watch publicly-available streams without their visit being attributed to platform metrics or ad inventory. It does **not**:

- target individual streamers
- coordinate with other instances
- claim to "hide" you from the platform's internal moderation tools
- modify the streamer's content in any way

**Please support the creators you watch.** Subscribing, donating, or buying merch directly is how streamers actually make a living — viewer count is just a number on a dashboard. Using GhostViewer instead of subscribing means the streamer doesn't get paid; if you watch someone regularly, sub or tip them.

**Do not use GhostViewer as part of any organised effort to harm a streamer's metrics, viewership, or income.** Using the tool that way runs counter to its design intent and may also violate the platform's terms of service for *you* as the user.

## Install

### From the Chrome Web Store

(Coming soon — pending review)

### From source (developer install)

1. Download or clone this repo.
2. Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select the project folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → select `manifest.json`.

## Development

No build step — pure HTML / CSS / vanilla JS. Edit and reload the extension.

To package a release:

```bash
# Excludes design-backup, .claude, dev-only docs
powershell -NoProfile -Command "Compress-Archive -Path manifest.json,background.js,popup.html,popup.js,player.html,player.js,storage.js,i18n.js,hls.min.js,rules.json,icons,_locales -DestinationPath GhostViewer.zip -Force"
```

## License

[Specify your license here — MIT is a common default for browser extensions]

## Acknowledgements

- [hls.js](https://github.com/video-dev/hls.js) — HLS playback library (bundled as `hls.min.js`)
- [7TV](https://7tv.app) — emote API

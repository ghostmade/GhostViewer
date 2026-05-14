# GhostViewer 👻

> A privacy-first viewer for Twitch and Kick streams.

GhostViewer is a Chrome and Firefox extension that redirects channels you add to a "ghost list" into a built-in HLS player. The player fetches the public stream manifest directly, so your visit:

- Does not count toward the streamer's viewer count
- Does not send tracking pings to the platform
- Does not require you to sign in to anything

A persistent **Ghost Mode** indicator stays visible while you watch.

## Features

- Twitch and Kick support (live and VOD)
- Anonymous live chat overlay (read-only)
- 7TV emotes, plus native Twitch and Kick emotes
- Emote hover previews
- Optional live notifications (off by default, per-channel mute)
- Stream stats: resolution, FPS, bitrate, buffer, dropped frames, latency
- Quality picker, Picture-in-Picture, Fullscreen with auto-hiding controls
- Resizable chat panel, per-channel volume memory, chat history persistence
- Web Audio volume with 1.5× boost above native max
- Keyboard shortcuts: `m` mute, `f` fullscreen, `c` chat, `t` timestamps, `s` stats, `+`/`-` chat font, `space` play/pause

## How it works

1. Click the GhostViewer icon and add a Twitch or Kick channel name to your ghost list.
2. Visit `twitch.tv/<channel>` or `kick.com/<channel>` normally. GhostViewer detects the navigation and replaces the page with its built-in player.
3. Channels not on your list load normally.

## Privacy

- Channel list and settings are stored locally (`chrome.storage.local`). Nothing is uploaded.
- No analytics, no telemetry, no tracking.
- Endpoints contacted: `gql.twitch.tv`, `*.ttvnw.net`, `*.live-video.net`, `kick.com`, `7tv.io`, `cdn.7tv.app`, `static-cdn.jtvnw.net`, `irc-ws.chat.twitch.tv`, `ws-us2.pusher.com`.
- Full policy: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

## Ethical use

GhostViewer is a personal viewing tool for watching publicly-available streams without contributing to platform analytics. It does not target individual streamers, coordinate with other instances, or modify stream content.

Please support the creators you watch. Subscribing, donating, or buying merch is how streamers make a living. Do not use GhostViewer as part of any organised effort to harm a streamer's metrics, viewership, or income.

## Install

### From the Chrome Web Store

(Coming soon, pending review.)

### From source

1. Download or clone this repo.
2. Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select the project folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → select `manifest.json`.

## License

All rights reserved. See [LICENSE](LICENSE) for details. The source is published for transparency and review, not redistribution.

## Acknowledgements

- [hls.js](https://github.com/video-dev/hls.js) (HLS playback library, bundled as `hls.min.js`)
- [7TV](https://7tv.app) (emote API)

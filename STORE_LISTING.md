# GhostViewer — Store listing copy

Drafts for Chrome Web Store and Firefox AMO. Edit before submitting.

---

## Short summary (132 chars max — Chrome Web Store)

**EN (124 chars):**
> A privacy-first viewer for Twitch and Kick streams. No tracking, no telemetry, no account, no view-count impact. Fully local.

**PL (118 chars):**
> Prywatny odtwarzacz dla streamów z Twitcha i Kicka. Bez trackingu, bez konta, bez wpływu na licznik widzów. W pełni lokalny.

---

## Long description (Chrome Web Store — up to 16,000 chars; aim for 800–1500)

```
👻 GhostViewer — A privacy-first viewer for Twitch and Kick streams.

GhostViewer is a viewing tool built around one idea: when you watch a
public stream, your visit shouldn't have to become a row in someone's
analytics database. Channels you add to your "ghost list" load through
GhostViewer's built-in HLS player instead of the regular Twitch or Kick
page. The result: no tracking pings, no telemetry, no platform analytics
about your session, no need to sign in anywhere.

A persistent "Ghost Mode" indicator stays visible while you watch so you
always know the private viewer is active.

──────────────────────────────────────────────────────────────────
What's private about it
──────────────────────────────────────────────────────────────────

  • Your channel list and settings stay on your device (chrome.storage.local).
    Nothing is uploaded — not even to GhostViewer's developer.
  • No analytics, telemetry, account, or cookies of our own.
  • No third-party SDKs (no Google Analytics, Sentry, Mixpanel, etc.).
  • The platform's tracking pixels (spade.twitch.tv, tracking.kick.com)
    are blocked by built-in declarativeNetRequest rules.
  • Source-available on GitHub. Every line of code is inspectable.

──────────────────────────────────────────────────────────────────
Features
──────────────────────────────────────────────────────────────────

  ✓ Twitch and Kick support — both live streams and VODs
  ✓ Live chat overlay
        – Twitch: anonymous IRC read-only connection (no login)
        – Kick: Pusher WebSocket (no login)
  ✓ 7TV emote support, with native Twitch and Kick emotes too
  ✓ Hover any emote for a large preview and its source platform
  ✓ Optional desktop notifications when a ghost-listed streamer goes live
        – Per-channel mute via bell icon
        – Off by default; opt in from the popup
        – Smart cooldown so re-watching doesn't spam re-notifications
  ✓ Stream stats overlay (resolution, FPS, bitrate, buffer, dropped
    frames, latency)
  ✓ Quality picker, Picture-in-Picture, fullscreen with auto-hiding
    floating controls
  ✓ Resizable chat panel + persistent settings (volume, font size, width)
  ✓ Chat history is preserved when you toggle the chat panel off and on
  ✓ Auto-reconnect when a stream goes offline mid-watch — picks back up
    automatically when the streamer comes back online
  ✓ Web Audio volume with perceptual curve and 1.5× boost above native max
  ✓ Keyboard shortcuts: m mute · f fullscreen · c chat · t timestamps ·
    s stats · +/- chat font · space play/pause
  ✓ Internationalised — English and Polish included; more locales planned

──────────────────────────────────────────────────────────────────
How it works
──────────────────────────────────────────────────────────────────

1. Click the GhostViewer icon and add a Twitch or Kick channel to your
   ghost list.
2. Visit twitch.tv/that-channel or kick.com/that-channel as you normally
   would. GhostViewer detects the navigation and replaces the page with
   its built-in private player.
3. Channels NOT on your ghost list are unaffected — they load normally.

Full privacy policy: <PASTE PRIVACY POLICY URL HERE BEFORE SUBMITTING>

──────────────────────────────────────────────────────────────────
Permissions explained
──────────────────────────────────────────────────────────────────

  • declarativeNetRequestWithHostAccess — adjusts Referer/Origin headers
    on direct CDN requests so the stream manifest loads, and blocks the
    platforms' tracking endpoints.
  • webNavigation, tabs — detects when you navigate to a ghost-listed
    channel so the private player can take over.
  • storage — saves your channel list, notification preferences, and
    player settings locally.
  • alarms, notifications — powers the optional live-notification feature
    (off by default).
  • Host permissions for twitch.tv, kick.com, 7tv.io, ttvnw.net,
    live-video.net, pusher.com, static-cdn.jtvnw.net — required to fetch
    stream manifests, chat, and emote metadata directly.

──────────────────────────────────────────────────────────────────
Source-available
──────────────────────────────────────────────────────────────────

The full source code is published for review and inspection.
Source code: https://github.com/ghostmade/GhostViewer
Issues / feedback: https://github.com/ghostmade/GhostViewer/issues

──────────────────────────────────────────────────────────────────
A note on creators
──────────────────────────────────────────────────────────────────

GhostViewer is a personal viewing tool for users who want to watch
publicly-available content without their visit becoming part of the
platform's analytics. It is not designed for organised viewership
manipulation, and using it that way runs against its intent. Streamers'
subscriber and follower counts are unaffected.

If you watch a creator regularly, please support them directly —
subscribing, donating, or buying merch is how streamers actually make a
living. View counts are a number on a dashboard; subscriptions are rent.
```

---

## Single-line tagline (for promo tile / social cards)

> Private viewer for Twitch and Kick.

---

## Category (Chrome Web Store)

**Primary:** Entertainment  
**Secondary candidates:** Productivity, Tools

(Entertainment fits best — it's a media-consumption tool.)

---

## Tags / search keywords

twitch, kick, stream, viewer, private, privacy, anonymous, hls, chat, 7tv, vod, picture-in-picture

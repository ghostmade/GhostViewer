# GhostViewer | Privacy Policy

**Last updated:** 2026-05-09

GhostViewer is a browser extension that lets you watch Twitch and Kick
streams through a built-in player, without contributing to the
streamer's view count, ad load, or platform telemetry.

This document explains what data the extension handles, what it sends
over the network, and what it does **not** do. If anything here is
unclear, please open an issue at
<https://github.com/ghostmade/GhostViewer/issues>.

---

## Summary

- **No analytics, no telemetry, no tracking.**
- **No account required**, anywhere.
- **All your data stays on your device.**
- **No data is sold, shared, or transmitted to GhostViewer's developers.**

---

## What GhostViewer stores on your device

GhostViewer uses your browser's local storage (`chrome.storage.local`)
for settings only. Nothing is uploaded.

The following keys are written:

| Key                       | Purpose                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `ghostChannels`           | The list of Twitch and Kick channel names you've added to your ghost list. |
| `gv_notif_enabled`        | Whether desktop notifications for live channels are enabled (off by default). |
| `gv_notif_muted`          | Per-channel notification mute list (the "bell" icons in the popup).       |
| `gv_live_state`           | The last-seen live/offline state of each ghost-listed channel, used to fire a notification only on the offline → online transition (not every poll). |
| `gv_migrated_to_local`    | One-time flag set after data is migrated from older `chrome.storage.sync`. |
| `gv_dismissed`            | Per-channel notification cooldown timestamps (set when you close a player tab while the channel was live). |

In addition, the player page uses `localStorage` for player UI
preferences only:

| Key                | Purpose                                                       |
|--------------------|---------------------------------------------------------------|
| `gv_chat_width`    | Width of the chat panel.                                      |
| `gv_chat_fs`       | Chat font size.                                               |
| `gv_volume`        | Last volume level.                                            |
| `gv_ts`            | Whether chat timestamps are toggled on.                       |
| `gv_pt_<channel>`  | Cached "winning" Twitch playerType per channel for faster startup. |

None of these keys are ever sent over the network.

---

## What GhostViewer sends over the network

Every network request the extension makes is to one of the following
endpoints, and only when needed to render the stream you asked to watch
or to check live status for notifications you opted in to.

### Twitch (when watching a Twitch channel)

- `https://gql.twitch.tv/gql`: Twitch's public GraphQL endpoint. Used to fetch the stream playback access token, viewer count, and live status. Same calls the official Twitch web player makes.
- `https://usher.ttvnw.net/api/channel/hls/<channel>.m3u8`: Twitch's HLS playlist server. Returns the stream manifest.
- `https://*.live-video.net/...`: Twitch's video CDN. Serves the actual video segments to your browser.
- `https://static-cdn.jtvnw.net/emoticons/...`: Twitch native emote images.
- `wss://irc-ws.chat.twitch.tv`: Anonymous read-only connection to Twitch chat (using the standard `justinfan` guest username pattern; no account, no login, no posting).

### Kick (when watching a Kick channel)

- `https://kick.com/api/v2/channels/<channel>`: Kick's public channel API. Returns playback URL, viewer count, chatroom ID, live status.
- `https://kick.com/api/v1/video/<id>`: Kick's public VOD API.
- `https://files.kick.com/emotes/...`: Kick native emote images.
- `wss://ws-us2.pusher.com`: Kick's public Pusher channel for chat messages.

### 7TV (third-party emote service, used for both platforms)

- `https://7tv.io/v3/...`: Public emote metadata API.
- `https://cdn.7tv.app/emote/...`: Emote images.

### What is in these requests

Each request contains only:

- The URL (channel name, video ID, etc., required for the request to function).
- Standard HTTP headers a browser normally sends (User-Agent, Accept, etc.).
- For Twitch CDN requests, the extension also sets the `Referer` header to `https://www.twitch.tv/` so the CDN serves the manifest, exactly as the official Twitch player does.

No identifying information about you is added to any request. The extension does not have access to a user account on Twitch, Kick, or anywhere else.

---

## What GhostViewer does NOT do

- Does **not** read or modify any other web page on your machine.
- Does **not** send your channel list, settings, or activity to any server.
- Does **not** use cookies for tracking purposes.
- Does **not** include any third-party analytics SDK (Google Analytics, Sentry, Mixpanel, etc.). None of these are present.
- Does **not** show ads.
- Does **not** require an account.
- Does **not** collect personally identifiable information.
- Does **not** sell or share data with third parties (because there is nothing to sell or share).

---

## Notifications

The optional "Notify me when a ghosted streamer goes live" feature is **off by default**. If you turn it on, the extension will:

1. Every ~3 minutes, query each channel on your ghost list against Twitch's or Kick's public live-status endpoints (the same endpoints listed above).
2. When a channel transitions from offline to online, show a desktop notification through your browser.
3. Compare against the previous state (`gv_live_state`) so you don't get repeat notifications while a stream stays live.

You can turn this off at any time from the popup. You can also mute notifications for individual channels using the bell icon next to each channel in the list.

---

## Permissions explained

| Permission                                  | Why it's needed                                                                                                                      |
|---------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| `declarativeNetRequestWithHostAccess`       | Block known tracking endpoints (e.g. `spade.twitch.tv`) and adjust `Referer` / `Origin` headers on Twitch CDN requests so the stream manifest loads correctly without going through twitch.tv. |
| `webNavigation`, `tabs`                     | Detect when you visit twitch.tv/<channel> or kick.com/<channel> so the extension can redirect ghost-listed channels to the built-in player. |
| `storage`                                   | Save your channel list, notification preferences, and player settings locally (see "What GhostViewer stores on your device" above). |
| `alarms`                                    | Schedule the periodic live-status check used by the optional notifications feature. Inactive while notifications are off.            |
| `notifications`                             | Show desktop notifications when a ghost-listed streamer goes live (only when notifications are enabled).                             |
| Host permissions for the listed domains     | Required so the extension can fetch stream manifests, emote images, and chat WebSockets directly from those domains.                 |

---

## Children's privacy

GhostViewer does not knowingly collect any personal information from anyone, including children. The extension does not host content, does not run accounts, and does not include any social or messaging features. Stream content itself is provided by Twitch and Kick and is subject to their respective terms of service and content policies.

## Intended use

GhostViewer is a personal viewing tool. The extension does not, and is not designed to, support organised viewership manipulation, brigading, harassment, or any coordinated effort to harm a streamer's metrics or income. Users are encouraged to support the creators they watch through direct subscriptions, donations, or other means provided by the streaming platforms. Use of the extension in violation of the streaming platforms' terms of service is the user's responsibility.

---

## Changes to this policy

If this privacy policy ever changes (for example, if a new feature requires a new endpoint), the change will be noted in the extension's changelog and at the top of this document. Material changes will also be flagged in the extension's release notes.

---

## Contact

GitHub repository: <https://github.com/ghostmade/GhostViewer>  
Issues / questions: <https://github.com/ghostmade/GhostViewer/issues>

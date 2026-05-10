// background.js — service worker
//
// Responsibilities:
//   1. One-time migration of channel list from chrome.storage.sync → chrome.storage.local.
//   2. Redirect navigations to ghosted twitch.tv / kick.com channels to player.html.
//   3. Optional opt-in live notifications when a ghosted streamer goes online.
//
// Storage helpers are loaded from storage.js via importScripts so we have one source of truth.
// importScripts is supported in MV3 service workers on both Chrome and Firefox 121+.

importScripts("storage.js");

// ── Constants ────────────────────────────────────────────────────────────────

const TWITCH_CLIENT_ID_BG = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const LIVE_ALARM_NAME     = "gv_live_check";

// ── One-time sync → local migration ──────────────────────────────────────────
// Runs once per browser profile. Defensive against odd shapes (missing keys,
// non-array values) so a malformed legacy entry can't abort SW registration.

async function runMigrationIfNeeded() {
  try {
    const { gv_migrated_to_local } = await chrome.storage.local.get("gv_migrated_to_local");
    if (gv_migrated_to_local) return;

    const safeArr = v => Array.isArray(v) ? v : [];
    const fromSync  = (await chrome.storage.sync.get("ghostChannels")).ghostChannels  || {};
    const fromLocal = (await chrome.storage.local.get("ghostChannels")).ghostChannels || {};

    const merged = {
      twitch: Array.from(new Set([...safeArr(fromLocal.twitch), ...safeArr(fromSync.twitch)])),
      kick:   Array.from(new Set([...safeArr(fromLocal.kick),   ...safeArr(fromSync.kick)])),
    };

    await chrome.storage.local.set({
      ghostChannels:        merged,
      gv_migrated_to_local: true,
    });

    console.log("[GhostViewer] Migrated channel list from sync → local",
                { twitch: merged.twitch.length, kick: merged.kick.length });
  } catch (e) {
    console.warn("[GhostViewer] Migration failed:", e?.message);
  }
}

// ── Pages to ignore on each platform ─────────────────────────────────────────

const TWITCH_IGNORED = new Set([
  "directory", "search", "subscriptions", "wallet", "settings",
  "downloads", "jobs", "p", "login", "signup", "activate",
  "bits", "store", "prime", "turbo", "videos", "clips", "drops"
]);

const KICK_IGNORED = new Set([
  "categories", "search", "browse", "dashboard", "login",
  "register", "terms", "privacy", "about"
]);

// ── Twitch VOD lookup: resolve a video ID to its owner's login ───────────────
// Used by the navigation listener so VOD URLs like /videos/12345 can be
// matched against the user's blacklist.
async function fetchTwitchVodChannel(vodId) {
  try {
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID_BG },
      body: JSON.stringify({ query: `{ video(id:"${vodId}") { owner { login } } }` })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.video?.owner?.login || null;
  } catch { return null; }
}

// ── Navigation listener — redirect ghosted channels to player ────────────────

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;

  if (details.url.startsWith("chrome-extension://") ||
      details.url.startsWith("moz-extension://")) return;

  let channel  = null;
  let platform = null;
  let vodId    = null;   // must live in the listener's scope, not just the try block,
                         // so the URLSearchParams construction below can read it.

  try {
    const url = new URL(details.url);

    if (url.hostname === "twitch.tv" || url.hostname === "www.twitch.tv") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 1 && !TWITCH_IGNORED.has(parts[0].toLowerCase())) {
        // Live stream: /<channel>
        channel  = parts[0];
        platform = "twitch";
      } else if (parts.length === 2 && parts[0].toLowerCase() === "videos" && /^\d+$/.test(parts[1])) {
        // VOD: /videos/<numeric-id>. We need a GQL lookup to know the channel for the blacklist check.
        const v = await fetchTwitchVodChannel(parts[1]);
        if (v) { channel = v; platform = "twitch"; vodId = parts[1]; }
      }
    }

    if (url.hostname === "kick.com" || url.hostname === "www.kick.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 1 && !KICK_IGNORED.has(parts[0].toLowerCase())) {
        // Live stream: /<channel>
        channel  = parts[0];
        platform = "kick";
      } else if (parts.length === 3 && parts[1].toLowerCase() === "videos" && !KICK_IGNORED.has(parts[0].toLowerCase())) {
        // VOD: /<channel>/videos/<uuid>
        channel  = parts[0];
        platform = "kick";
        vodId    = parts[2];
      }
    }
  } catch (_) {
    return;
  }

  if (!channel || !platform) return;
  if (!await Storage.isGhosted(platform, channel)) return;

  const params = new URLSearchParams({ channel, platform });
  if (vodId) params.set("vodId", vodId);
  const playerUrl = chrome.runtime.getURL(`player.html?${params}`);
  chrome.tabs.update(details.tabId, { url: playerUrl });
}, {
  url: [
    { hostSuffix: "twitch.tv" },
    { hostSuffix: "kick.com" }
  ]
});

// ────────────────────────────────────────────────────────────────────────────
// LIVE NOTIFICATIONS — opt-in
// ────────────────────────────────────────────────────────────────────────────
//
// Polls each ghosted channel every ~3 minutes when the user has notifications
// enabled in the popup. Stores the last seen "is-live" state per channel so
// notifications only fire on the offline → online edge, not every poll while
// the streamer is live.
//
// Storage keys used:
//   gv_notif_enabled  : boolean    — global toggle (popup checkbox)
//   gv_notif_muted    : { twitch:[], kick:[] } — per-channel mutes (bell icon)
//   gv_live_state     : { "twitch:name": bool, "kick:name": bool } — last seen

async function isNotifEnabled() {
  const { gv_notif_enabled } = await chrome.storage.local.get("gv_notif_enabled");
  return !!gv_notif_enabled;
}

async function getMuted() {
  const { gv_notif_muted } = await chrome.storage.local.get("gv_notif_muted");
  return gv_notif_muted || { twitch: [], kick: [] };
}

async function ensureAlarm() {
  const enabled = await isNotifEnabled();
  const existing = await chrome.alarms.get(LIVE_ALARM_NAME);
  if (enabled && !existing) {
    chrome.alarms.create(LIVE_ALARM_NAME, { delayInMinutes: 0.5, periodInMinutes: 3 });
  } else if (!enabled && existing) {
    chrome.alarms.clear(LIVE_ALARM_NAME);
  }
}

// Single onInstalled listener — runs migration AND wires up the alarm.
chrome.runtime.onInstalled.addListener(async () => {
  await runMigrationIfNeeded();
  await ensureAlarm();
});
chrome.runtime.onStartup.addListener(ensureAlarm);

// Re-evaluate when the popup toggles the setting.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.gv_notif_enabled) ensureAlarm();
});

async function checkTwitchLive(name) {
  try {
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID_BG },
      body: JSON.stringify({ query: `{ user(login:"${name.toLowerCase()}") { stream { id } } }` })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.user?.stream?.id ? true : false;
  } catch (_) { return null; }
}

async function checkKickLive(name) {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${name}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return !!(data?.livestream && data?.livestream?.is_live !== false);
  } catch (_) { return null; }
}

// ── Notification cooldown after a watched-then-closed stream ────────────────
// When the user closes a player tab while the channel is live, we suppress
// further notifications for that channel for NOTIF_DISMISS_HOURS. Two
// short-circuits expire the dismissal early:
//   1. The channel goes online → offline (cleared in runLiveCheck below).
//   2. The cooldown timer elapses.

const NOTIF_DISMISS_HOURS = 4;
const NOTIF_DISMISS_MS    = NOTIF_DISMISS_HOURS * 60 * 60 * 1000;

// Tab → {platform, channel} map, tracked while player tabs are open.
// Stored in chrome.storage.session so it survives service-worker restarts
// (tab IDs themselves only live for one browser session, which matches).

const PLAYER_URL = chrome.runtime.getURL("player.html");

async function recordWatchTab(tabId, url) {
  if (!url || !url.startsWith(PLAYER_URL)) {
    // Tab navigated AWAY from the player → treat as close
    await dismissTab(tabId);
    return;
  }
  let platform, channel;
  try {
    const u  = new URL(url);
    platform = u.searchParams.get("platform");
    channel  = u.searchParams.get("channel");
  } catch { return; }
  if (!platform || !channel) return;

  const r    = await chrome.storage.session.get("gv_watch_tabs");
  const tabs = r.gv_watch_tabs || {};
  tabs[tabId] = { platform, channel };
  await chrome.storage.session.set({ gv_watch_tabs: tabs });
}

async function dismissTab(tabId) {
  const r    = await chrome.storage.session.get("gv_watch_tabs");
  const tabs = r.gv_watch_tabs || {};
  const info = tabs[tabId];
  if (!info) return;
  delete tabs[tabId];
  await chrome.storage.session.set({ gv_watch_tabs: tabs });

  // Only register a cooldown if the channel was live at close time.
  // If they closed while it was offline (e.g. just browsing the player),
  // there's no risk of immediate re-notification spam.
  const { gv_live_state = {} } = await chrome.storage.local.get("gv_live_state");
  const key = `${info.platform}:${info.channel}`;
  if (!gv_live_state[key]) return;

  const { gv_dismissed = {} } = await chrome.storage.local.get("gv_dismissed");
  gv_dismissed[key] = Date.now() + NOTIF_DISMISS_MS;
  await chrome.storage.local.set({ gv_dismissed });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) recordWatchTab(tabId, changeInfo.url);
});
chrome.tabs.onRemoved.addListener(tabId => { dismissTab(tabId); });

// Don't fire a "going live" notification if the user already has a tab open
// on the ghost player for this exact channel — they're presumably watching
// already, so the notification would be noise.
async function isAlreadyWatching(platform, name) {
  try {
    // Filter to just our extension's player URLs — much smaller result set
    // than scanning every tab in every window.
    const tabs = await chrome.tabs.query({ url: PLAYER_URL + "*" });
    return tabs.some(t => {
      try {
        const u = new URL(t.url);
        return u.searchParams.get("platform") === platform &&
               u.searchParams.get("channel")  === name;
      } catch { return false; }
    });
  } catch { return false; }
}

async function notifyLive(platform, name) {
  // Notification IDs are namespaced so click handler can route back to the right player.
  const id = `gv_live:${platform}:${name}`;
  const title = chrome.i18n.getMessage("notifLiveTitle", [name]) || `${name} is live`;
  const body  = chrome.i18n.getMessage("notifLiveBody")          || "Click to ghost-watch";
  const btn   = chrome.i18n.getMessage("notifLiveBtn")           || "Watch in Ghost Mode";
  try {
    await chrome.notifications.create(id, {
      type:     "basic",
      iconUrl:  chrome.runtime.getURL("icons/ghost128.png"),
      title,
      message:  body,
      contextMessage: platform.charAt(0).toUpperCase() + platform.slice(1),
      buttons:  [{ title: btn }],
    });
  } catch (e) {
    console.warn("[GhostViewer] notification failed:", e?.message);
  }
}

async function runLiveCheck() {
  if (!await isNotifEnabled()) return;

  const channels = await Storage.getChannels();
  const muted    = await getMuted();
  const { gv_live_state = {} } = await chrome.storage.local.get("gv_live_state");
  const { gv_dismissed = {} }  = await chrome.storage.local.get("gv_dismissed");
  const next = { ...gv_live_state };
  let dismissedDirty = false;

  // Build the (platform, name) pairs we want to poll, skipping muted channels.
  const targets = [];
  for (const name of channels.twitch || []) if (!muted.twitch.includes(name)) targets.push(["twitch", name]);
  for (const name of channels.kick   || []) if (!muted.kick.includes(name))   targets.push(["kick",   name]);

  const now = Date.now();

  // Throttle to small batches so we don't burst-hit either API on large lists.
  for (let i = 0; i < targets.length; i++) {
    const [platform, name] = targets[i];
    const live = platform === "twitch" ? await checkTwitchLive(name) : await checkKickLive(name);
    if (live === null) continue;   // network failed — leave previous state untouched

    const key  = `${platform}:${name}`;
    const prev = !!gv_live_state[key];
    next[key]  = live;

    // Stream went online → offline: clear cooldown so the next "going live"
    // event will notify normally. Matches the user's "stream stops" rule.
    if (!live && prev && gv_dismissed[key]) {
      delete gv_dismissed[key];
      dismissedDirty = true;
    }
    // Time-based expiry of any stale dismissal.
    if (gv_dismissed[key] && gv_dismissed[key] <= now) {
      delete gv_dismissed[key];
      dismissedDirty = true;
    }

    // Stream went offline → online: notify, unless still in cooldown or
    // the channel is already open in a tab.
    if (live && !prev) {
      const stillDismissed = gv_dismissed[key] && gv_dismissed[key] > now;
      if (!stillDismissed && !await isAlreadyWatching(platform, name)) {
        await notifyLive(platform, name);
      }
    }

    if (i < targets.length - 1) await new Promise(r => setTimeout(r, 200));
  }

  // Cleanup: drop dismissals/state for channels no longer in the ghost list.
  const validKeys = new Set(targets.map(([p, n]) => `${p}:${n}`));
  for (const k of Object.keys(gv_dismissed)) {
    if (!validKeys.has(k)) { delete gv_dismissed[k]; dismissedDirty = true; }
  }
  for (const k of Object.keys(next)) {
    if (!validKeys.has(k)) delete next[k];
  }

  await chrome.storage.local.set({ gv_live_state: next });
  if (dismissedDirty) await chrome.storage.local.set({ gv_dismissed });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === LIVE_ALARM_NAME) runLiveCheck();
});

// Open the ghost player when the user clicks a live notification.
function openPlayerFromNotif(notifId) {
  const m = /^gv_live:(twitch|kick):(.+)$/.exec(notifId);
  if (!m) return;
  const [, platform, name] = m;
  const url = chrome.runtime.getURL(
    `player.html?channel=${encodeURIComponent(name)}&platform=${platform}`
  );
  chrome.tabs.create({ url });
  chrome.notifications.clear(notifId);
}
chrome.notifications.onClicked.addListener(openPlayerFromNotif);
chrome.notifications.onButtonClicked.addListener((id, _btnIdx) => openPlayerFromNotif(id));

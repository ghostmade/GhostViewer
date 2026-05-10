// player.js — GhostViewer stream + chat player

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TWITCH_CLIENT_ID   = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TWITCH_IRC_WS      = "wss://irc-ws.chat.twitch.tv";
// Kick Pusher — current key first, legacy fallback
const KICK_PUSHER_KEYS = [
  "eb1d5f283081a78b932c",  // current (2025)
  "32cbd69e4b950bf97679",  // legacy fallback
];

// Inline GraphQL query for the playback-access-token call. This used to be
// a persisted-query hash, but Twitch rotates the hash occasionally and a
// stale hash returns 200 OK with a null token (not a 400 we could detect),
// silently breaking stream loading. Sending the full query inline removes
// that dependency — the schema travels with the request.
const PLAYBACK_TOKEN_QUERY = `query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {
  streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {
    value
    signature
    authorization { isForbidden forbiddenReasonCode }
    __typename
  }
  videoPlaybackAccessToken(id: $vodID, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {
    value
    signature
    __typename
  }
}`;

// playerType priority — embed has fewest ads, especially in low-ad regions (PL, etc.)
const PLAYER_TYPES = ["embed", "autoplay", "picture-in-picture", "site"];

// Cache the winning playerType per channel in localStorage to skip rotation on repeat visits
function getCachedPlayerType(ch) {
  try { return localStorage.getItem(`gv_pt_${ch}`) || null; } catch { return null; }
}
function setCachedPlayerType(ch, pt) {
  try { localStorage.setItem(`gv_pt_${ch}`, pt); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// URL PARAMS
// ═══════════════════════════════════════════════════════════════

const urlParams = new URLSearchParams(window.location.search);
const channel   = urlParams.get("channel") || "";
const platform  = urlParams.get("platform") || "twitch";
const vodId     = urlParams.get("vodId") || "";   // when set: VOD mode (no live chat, no live polling)
const isVod     = !!vodId;

// ═══════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════

const videoSide      = document.getElementById("video-side");
const videoEl        = document.getElementById("stream");
const overlay        = document.getElementById("overlay");
const overlayMsg     = document.getElementById("overlay-msg");
const retryBtn       = document.getElementById("retry-btn");
const statusText     = document.getElementById("status-text");
const liveDot        = document.getElementById("live-dot");
const channelNameEl  = document.getElementById("channel-name");
const platformBadge  = document.getElementById("platform-badge");
const qualSel        = document.getElementById("quality-select");
const chatMessages   = document.getElementById("chat-messages");
const chatStatus     = document.getElementById("chat-status");
const chatViewerCnt  = document.getElementById("chat-viewer-count");
const scrollBtn      = document.getElementById("scroll-to-bottom");
const btnPlay        = document.getElementById("btn-play");
const playLabel      = document.getElementById("play-label");
const playIcon       = document.getElementById("play-icon");
const btnMute        = document.getElementById("btn-mute");
const muteLabel      = document.getElementById("mute-label");
const volumeSlider   = document.getElementById("volume-slider");
const btnFit         = document.getElementById("btn-fit");
const fitLabel       = document.getElementById("fit-label");
const btnPip         = document.getElementById("btn-pip");
const btnStats       = document.getElementById("btn-stats");
const statsPanel     = document.getElementById("stats-panel");
const btnRefresh     = document.getElementById("btn-refresh");
const refreshLabel   = document.getElementById("refresh-label");
const refreshIcon    = document.getElementById("refresh-icon");
const btnChat        = document.getElementById("btn-chat");
const btnFs          = document.getElementById("btn-fs");
const fsLabel        = document.getElementById("fs-label");
const chatSide       = document.getElementById("chat-side");
const chatFontLabel  = document.getElementById("chat-font-size-label");
const btnFontDown    = document.getElementById("btn-font-down");
const btnFontUp      = document.getElementById("btn-font-up");
const btnTimestamps  = document.getElementById("btn-timestamps");
const resizeHandle   = document.getElementById("chat-resize-handle");

// ═══════════════════════════════════════════════════════════════
// STATIC UI SETUP
// ═══════════════════════════════════════════════════════════════

const platformHome = platform === "twitch" ? "https://www.twitch.tv" : "https://www.kick.com";
const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
channelNameEl.textContent = channel || "?";
platformBadge.textContent = platform;
platformBadge.className   = `platform-badge ${platform}`;
platformBadge.href        = platformHome;
platformBadge.title       = gvI18n("platformBadgeTitle", platformLabel);
document.title            = gvI18n("playerTitle", channel);

// ── Locale-aware button widths ──────────────────────────────────
// Measure the actual rendered width of every label variant in the CURRENT
// locale and set the matching CSS custom property to fit just the longest.
// This way EN users don't pay for Polish word lengths and vice-versa.
function measureLabelPx(text) {
  const span = document.createElement("span");
  span.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;" +
    "font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
    "font-weight:normal;pointer-events:none;left:-9999px;top:-9999px;";
  span.textContent = text;
  document.body.appendChild(span);
  const w = span.getBoundingClientRect().width;
  span.remove();
  return Math.ceil(w);
}
(function setLocaleAwareLabelWidths() {
  const breathingRoom = 4;
  const sets = {
    "--label-w-play":    [gvI18n("ctrlPlay"),       gvI18n("ctrlPause")],
    "--label-w-mute":    [gvI18n("ctrlMute"),       gvI18n("ctrlUnmute")],
    "--label-w-fit":     [gvI18n("ctrlFit"),        gvI18n("ctrlFill")],
    "--label-w-fs":      [gvI18n("ctrlFullscreen"), gvI18n("ctrlExitFullscreen")],
    "--label-w-refresh": [gvI18n("ctrlRefresh"),    gvI18n("ctrlResume")],
  };
  for (const [varName, texts] of Object.entries(sets)) {
    const widest = Math.max(...texts.map(measureLabelPx));
    document.documentElement.style.setProperty(varName, (widest + breathingRoom) + "px");
  }
})();

// ═══════════════════════════════════════════════════════════════
// TWITCH HLS — playerType rotation + M3U8 ad detection
// ═══════════════════════════════════════════════════════════════

async function fetchTwitchToken(playerType) {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken_Template",
      query: PLAYBACK_TOKEN_QUERY,
      variables: {
        isLive: true,
        login: channel.toLowerCase(),
        isVod: false,
        vodID: "",
        playerType,
        platform: "web",
      },
    }),
  });

  if (!res.ok) throw new Error(`GQL error: ${res.status}`);
  const data = await res.json();
  if (data.errors) {
    console.error("[GhostViewer] GQL errors for token:", data.errors);
    throw new Error(`GQL: ${data.errors[0]?.message || "unknown error"}`);
  }
  const token = data?.data?.streamPlaybackAccessToken;
  if (!token) {
    console.error("[GhostViewer] No streamPlaybackAccessToken in response:", data);
    throw new Error("Stream not found or offline");
  }
  if (token.authorization?.isForbidden) {
    console.warn("[GhostViewer] Playback authorization forbidden:",
                 token.authorization.forbiddenReasonCode);
  }
  return token;
}

function buildUsherUrl(ch, token) {
  const params = new URLSearchParams({
    sig: token.signature, token: token.value,
    allow_source: "true", allow_spectre: "false",
    fast_bread: "true", player_backend: "mediaplayer",
    playlist_include_framerate: "true", reassignments_supported: "true",
    supported_codecs: "avc1",
    p: Math.floor(Math.random() * 9_999_999)
  });
  return `https://usher.ttvnw.net/api/channel/hls/${ch}.m3u8?${params}`;
}

function m3u8HasAds(text) {
  return /Amazon\|\d+/i.test(text) || /stitched-ad/i.test(text);
}

async function getTwitchHLSUrl() {
  // Check if we have a cached winning playerType for this channel
  const cached = getCachedPlayerType(channel);
  const order  = cached
    ? [cached, ...PLAYER_TYPES.filter(t => t !== cached)]
    : PLAYER_TYPES;

  let lastErr = null;

  for (const playerType of order) {
    let token;
    try { token = await fetchTwitchToken(playerType); }
    catch (e) { lastErr = e; continue; }

    const url = buildUsherUrl(channel, token);
    let m3u8Text = "";
    try {
      const r = await fetch(url);
      if (!r.ok) { lastErr = new Error(`Usher ${r.status}`); continue; }
      m3u8Text = await r.text();
    } catch (e) { lastErr = e; continue; }

    if (!m3u8HasAds(m3u8Text)) {
      setCachedPlayerType(channel, playerType);  // remember winner
      return { url, adDetected: false, playerType };
    }
  }

  // All types returned ads — use embed as best-effort fallback
  try {
    const token = await fetchTwitchToken("embed");
    return { url: buildUsherUrl(channel, token), adDetected: true, playerType: "embed" };
  } catch (e) { throw lastErr || e; }
}

// ═══════════════════════════════════════════════════════════════
// TWITCH VOD HLS
// ═══════════════════════════════════════════════════════════════
// VODs use the same PlaybackAccessToken GQL operation but with isVod:true
// and a vodID, returning videoPlaybackAccessToken (instead of stream...).

async function fetchTwitchVodToken(playerType) {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID },
    body: JSON.stringify({
      operationName: "PlaybackAccessToken_Template",
      query: PLAYBACK_TOKEN_QUERY,
      variables: {
        isLive: false,
        login: "",
        isVod: true,
        vodID: vodId,
        playerType,
        platform: "web",
      },
    }),
  });

  if (!res.ok) throw new Error(`GQL error: ${res.status}`);
  const data = await res.json();
  if (data.errors) {
    console.error("[GhostViewer] GQL errors for VOD token:", data.errors);
    throw new Error(`GQL: ${data.errors[0]?.message || "unknown error"}`);
  }
  const token = data?.data?.videoPlaybackAccessToken;
  if (!token) {
    console.error("[GhostViewer] No videoPlaybackAccessToken in response:", data);
    throw new Error("VOD not found");
  }
  return token;
}

async function getTwitchVodHLSUrl() {
  const token = await fetchTwitchVodToken("embed");
  const params = new URLSearchParams({
    sig: token.signature, token: token.value,
    allow_source: "true", allow_audio_only: "true",
    p: Math.floor(Math.random() * 9_999_999)
  });
  return { url: `https://usher.ttvnw.net/vod/${vodId}.m3u8?${params}`, adDetected: false };
}

// ═══════════════════════════════════════════════════════════════
// KICK HLS
// ═══════════════════════════════════════════════════════════════

async function getKickHLSUrl() {
  const extract = d =>
    d?.livestream?.playback_url || d?.playback_url ||
    d?.data?.livestream?.playback_url || d?.data?.playback_url || null;

  for (const url of [
    `https://kick.com/api/v2/channels/${channel}`,
    `https://kick.com/api/v1/channels/${channel}`
  ]) {
    try {
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) continue;
      const data   = await res.json();
      const hlsUrl = extract(data);
      if (hlsUrl) return { url: hlsUrl, adDetected: false };
    } catch (_) { continue; }
  }
  throw new Error("Channel offline or not found on Kick");
}

// ═══════════════════════════════════════════════════════════════
// KICK VOD HLS
// ═══════════════════════════════════════════════════════════════

async function getKickVodHLSUrl() {
  // Kick VODs are exposed via /api/v1/video/<uuid>; the response shape varies
  // (source / playback_url / source url under different keys depending on era).
  const res = await fetch(`https://kick.com/api/v1/video/${vodId}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`VOD not found (${res.status})`);
  const data = await res.json();
  const url  = data?.source                ||
               data?.playback_url          ||
               data?.video?.source         ||
               data?.video?.playback_url   ||
               null;
  if (!url) throw new Error("VOD playback URL not found");
  return { url, adDetected: false };
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY / STATUS
// ═══════════════════════════════════════════════════════════════

function showOverlay(msg, showRetry = false) {
  overlay.classList.remove("hidden");
  overlayMsg.textContent    = msg;
  retryBtn.style.display    = showRetry ? "inline-block" : "none";
  statusText.textContent    = showRetry ? gvI18n("playerStatusError") : msg;
  liveDot.classList.remove("visible");
}

function hideOverlay() {
  overlay.classList.add("hidden");
  if (isVod) {
    statusText.textContent = gvI18n("modeVod");
  } else {
    statusText.textContent = gvI18n("playerStatusLive");
    liveDot.classList.add("visible");
  }
  stopLivePolling();   // playback succeeded — no need to keep polling
}

// ═══════════════════════════════════════════════════════════════
// QUALITY SELECTOR
// ═══════════════════════════════════════════════════════════════

// Mutate the existing <select> in place so repeat calls (e.g. after silentReload) work.
// Using cloneNode + replaceWith would orphan the cached qualSel reference on the second call.
let qualChangeHandler = null;

function populateQualities(hls) {
  if (qualChangeHandler) qualSel.removeEventListener("change", qualChangeHandler);

  const prev = parseInt(qualSel.value, 10);
  qualSel.innerHTML = "";
  const auto = document.createElement("option");
  auto.value = "-1";
  auto.textContent = gvI18n("ctrlQualityAuto");
  qualSel.appendChild(auto);
  hls.levels.forEach((level, i) => {
    const fps   = level.attrs?.FRAMERATE ? Math.round(level.attrs.FRAMERATE) : "";
    const label = level.height ? `${level.height}p${fps}` : `Level ${i}`;
    const opt   = document.createElement("option");
    opt.value = i; opt.textContent = label;
    qualSel.appendChild(opt);
  });
  // Try to restore the previous selection if it still maps to a valid level
  if (Number.isFinite(prev) && prev >= -1 && prev < hls.levels.length) {
    qualSel.value = String(prev);
    hls.currentLevel = prev;
  }

  qualChangeHandler = () => { hls.currentLevel = parseInt(qualSel.value, 10); };
  qualSel.addEventListener("change", qualChangeHandler);
}

// ═══════════════════════════════════════════════════════════════
// STREAM STATS
// ═══════════════════════════════════════════════════════════════

// Stats panel: cache the row elements once instead of looking them up by id
// on every tick, and only run the interval while the panel is actually visible.
const statEls = {
  res:     document.getElementById("stat-res"),
  fps:     document.getElementById("stat-fps"),
  bitrate: document.getElementById("stat-bitrate"),
  buffer:  document.getElementById("stat-buffer"),
  dropped: document.getElementById("stat-dropped"),
  latency: document.getElementById("stat-latency"),
};

let statsInterval = null;
let statsHls      = null;   // last hls instance — captured so the toggle button can (re)start the interval

function tickStats() {
  const hls = statsHls;
  // Guard against the brief window during a stream restart where statsHls
  // points at a now-destroyed HLS instance (between hls.destroy() and the
  // next MANIFEST_PARSED that re-records statsHls). Accessing properties
  // on a destroyed instance can throw.
  if (!hls || !hls.levels) return;

  try {
    const level = hls.levels[hls.currentLevel];
    statEls.res.textContent     = level ? `${level.width || "?"}×${level.height || "?"}` : "-";
    statEls.fps.textContent     = level?.attrs?.FRAMERATE ? `${Math.round(level.attrs.FRAMERATE)}` : "-";

    const bw = hls.bandwidthEstimate;
    statEls.bitrate.textContent = bw ? `${Math.round(bw / 1000)} kbps` : "-";

    if (videoEl.buffered.length > 0) {
      const buf = videoEl.buffered.end(videoEl.buffered.length - 1) - videoEl.currentTime;
      statEls.buffer.textContent = `${buf.toFixed(1)}s`;
    } else {
      statEls.buffer.textContent = "-";
    }

    const quality = videoEl.getVideoPlaybackQuality?.();
    statEls.dropped.textContent = quality ? `${quality.droppedVideoFrames}` : "-";

    const lat = hls.latency;
    statEls.latency.textContent = lat != null ? `${lat.toFixed(2)}s` : "-";
  } catch { /* destroyed mid-tick — next tick will see fresh hls */ }
}

function startStatsInterval(hls) {
  // Just record the current hls instance. The interval itself is started
  // lazily when the user opens the stats panel — keeping it dormant when
  // hidden saves ~1 wakeup/sec for the typical user.
  statsHls = hls;
}

function startStatsTicking() {
  if (statsInterval) return;
  tickStats();   // immediate first paint so the panel isn't blank for 1s
  statsInterval = setInterval(tickStats, 1000);
}

function stopStatsTicking() {
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
}

// ═══════════════════════════════════════════════════════════════
// AD STRIPPING — mid-roll detection + silent playerType swap
// ═══════════════════════════════════════════════════════════════

let reloadInProgress = false;
let reloadDeadline   = null;   // safety net so a stuck reload can never permanently block future ones

async function silentReload() {
  if (reloadInProgress || platform !== "twitch") return;
  reloadInProgress = true;
  // Safety net: if the loop hangs, force-clear the flag after 12s so we can try again later.
  clearTimeout(reloadDeadline);
  reloadDeadline = setTimeout(() => { reloadInProgress = false; }, 12000);

  try {
    for (const playerType of PLAYER_TYPES) {
      try {
        const token = await fetchTwitchToken(playerType);
        const url   = buildUsherUrl(channel, token);
        const r     = await fetch(url);
        if (!r.ok) continue;
        const text  = await r.text();
        if (!m3u8HasAds(text)) {
          if (hlsInstance) hlsInstance.loadSource(url);
          setCachedPlayerType(channel, playerType);
          statusText.textContent = gvI18n("playerStatusLive");
          return;
        }
      } catch (_) {}
    }
  } finally {
    clearTimeout(reloadDeadline);
    reloadDeadline   = null;
    reloadInProgress = false;
  }
}

function installAdStripping(hls) {
  hls.on(Hls.Events.LEVEL_UPDATED, (_e, data) => {
    const hasAd = data?.details?.fragments?.some(f =>
      f?.tagList?.some(t => /Amazon\|\d+/i.test(t?.[1] || "") || /stitched-ad/i.test(t?.[1] || ""))
    );
    if (hasAd) silentReload();
  });
}

// ═══════════════════════════════════════════════════════════════
// STREAM PLAYER
// ═══════════════════════════════════════════════════════════════

let hlsInstance         = null;
let startStreamInFlight = false;   // guard against concurrent invocations

async function startStream() {
  // If a previous startStream is still resolving (waiting on GQL / Usher),
  // drop this call. The user clicking Refresh repeatedly, or the live-poll
  // firing during a manual restart, won't spawn parallel HLS instances.
  if (startStreamInFlight) return;
  startStreamInFlight = true;
  try {
    await _startStream();
  } finally {
    startStreamInFlight = false;
  }
}

async function _startStream() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (statsInterval) { clearInterval(statsInterval); statsInterval = null; }
  statsHls = null;   // drop reference to the destroyed instance
  videoEl.src = "";
  showOverlay(gvI18n("playerStatusFetching"));
  if (!channel) { showOverlay(gvI18n("playerErrNoChannel")); return; }

  let hlsUrl;
  try {
    showOverlay(gvI18n("playerStatusConnecting"));
    let result;
    if (isVod) {
      result = platform === "twitch" ? await getTwitchVodHLSUrl() : await getKickVodHLSUrl();
    } else {
      result = platform === "twitch" ? await getTwitchHLSUrl() : await getKickHLSUrl();
    }
    hlsUrl = result.url;
  } catch (err) {
    console.error("[GhostViewer] startStream failed:", err);
    showOverlay(gvI18n("playerErrLoad", err.message), true);
    // Live polling only makes sense for live streams — VODs don't come back.
    if (!isVod) startLivePolling();
    return;
  }

  if (Hls.isSupported()) {
    // VODs don't need low-latency mode (and ad-stripping uses live-stream playerType
    // rotation, which would re-fetch a different VOD URL — skip it).
    const hls = new Hls({
      enableWorker:     true,
      lowLatencyMode:   !isVod,
      backBufferLength: isVod ? 90 : 60,
    });
    hlsInstance = hls;
    if (!isVod) installAdStripping(hls);

    hls.loadSource(hlsUrl);
    hls.attachMedia(videoEl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      populateQualities(hls);
      startStatsInterval(hls);
      hideOverlay();
      videoEl.play().catch(() => { statusText.textContent = gvI18n("playerStatusPressPlay"); });
    });

    let netErrCount = 0;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      console.error("[GhostViewer] HLS error:", data.type, data.details, data);
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        netErrCount++;
        if (netErrCount <= 3) { showOverlay(gvI18n("playerStatusNetRetry")); hls.startLoad(); }
        else { showOverlay(gvI18n("playerErrFailed"), true); startLivePolling(); }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        showOverlay(gvI18n("playerErrGeneric", data.details), true);
      }
    });

  } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
    videoEl.src = hlsUrl;
    videoEl.addEventListener("loadedmetadata", () => { hideOverlay(); videoEl.play().catch(() => {}); }, { once: true });
    videoEl.addEventListener("error", () => { showOverlay(gvI18n("playerErrPlay"), true); }, { once: true });
  } else {
    showOverlay(gvI18n("playerErrUnsupported"));
  }
}

retryBtn.addEventListener("click", () => {
  stopLivePolling();
  startStream();
});

// ═══════════════════════════════════════════════════════════════
// AUTO-RECONNECT — poll is-live when the stream is offline
// ═══════════════════════════════════════════════════════════════
// When the stream is unavailable (offline / "channel not found" /
// fatal HLS network errors), poll the is-live endpoint every ~45s.
// As soon as the streamer is back online, restart playback automatically.

let livePollTimer = null;

async function isStreamerLive() {
  try {
    if (platform === "twitch") {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID },
        body: JSON.stringify({ query: `{ user(login:"${channel.toLowerCase()}") { stream { id } } }` })
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.data?.user?.stream?.id;
    } else {
      const res = await fetch(`https://kick.com/api/v2/channels/${channel}`, { headers: { Accept: "application/json" } });
      if (!res.ok) return false;
      const data = await res.json();
      return !!(data?.livestream && data?.livestream?.is_live !== false);
    }
  } catch { return false; }
}

function stopLivePolling() {
  if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
  syncRefreshUI();
}

function startLivePolling() {
  if (livePollTimer) return;   // already polling
  showOverlay(gvI18n("playerWaitingForLive"), false);
  // Poll every 45s. The first check fires after the interval, not immediately,
  // because we just failed a fetch — give the streamer a moment.
  livePollTimer = setInterval(async () => {
    if (await isStreamerLive()) {
      stopLivePolling();
      startStream();   // back online — startStream() will hide the overlay on success
    }
  }, 45_000);
  syncRefreshUI();
}

// Refresh / Resume button: same action either way (re-run startStream),
// label and icon swap based on whether we're currently waiting for the
// streamer to come back online.
const REFRESH_PATH = "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z";
const RESUME_PATH  = "M8 5v14l11-7z";

function syncRefreshUI() {
  const offline = !!livePollTimer;
  if (offline) {
    refreshLabel.textContent = gvI18n("ctrlResume");
    refreshIcon.setAttribute("d", RESUME_PATH);
    btnRefresh.classList.add("active");
    btnRefresh.title = gvI18n("ctrlResumeTitle");
  } else {
    refreshLabel.textContent = gvI18n("ctrlRefresh");
    refreshIcon.setAttribute("d", REFRESH_PATH);
    btnRefresh.classList.remove("active");
    btnRefresh.title = gvI18n("ctrlRefreshTitle");
  }
}

btnRefresh.addEventListener("click", () => {
  stopLivePolling();
  startStream();
});

// ═══════════════════════════════════════════════════════════════
// 7TV EMOTE ENGINE
// ═══════════════════════════════════════════════════════════════

// emoteMap: name -> { url1x, url2x, zeroWidth, animated }
const emoteMap  = new Map();
let emotesReady = false;

function registerEmote(emote) {
  const id        = emote?.data?.id || emote?.id;
  const name      = emote?.name;
  const flags     = emote?.data?.flags ?? 0;
  const animated  = !!(emote?.data?.animated);
  const zeroWidth = !!(flags & 256);
  if (!id || !name) return;
  const base = `https://cdn.7tv.app/emote/${id}`;
  emoteMap.set(name, {
    id,
    url1x: `${base}/1x.webp`,
    url2x: `${base}/2x.webp`,
    url4x: `${base}/4x.webp`,   // hover preview
    zeroWidth, animated, name,
  });
}

async function fetchTwitchUserIdForEmotes(login) {
  // Free-form GQL — works with our browser client ID
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID },
    body: JSON.stringify({ query: `{ user(login: "${login}") { id } }` })
  });
  if (!res.ok) throw new Error("GQL user lookup failed");
  const data = await res.json();
  const id   = data?.data?.user?.id;
  if (!id) throw new Error("ID not found");
  return id;
}

async function load7TVEmotes() {
  if (platform !== "twitch") return;
  try {
    const res  = await fetch("https://7tv.io/v3/emote-sets/global");
    const data = await res.json();
    for (const e of (data?.emotes || [])) registerEmote(e);
  } catch (e) { console.warn("[7TV] Global emotes failed:", e.message); }

  let userId = null;
  try { userId = await fetchTwitchUserIdForEmotes(channel); }
  catch (_) { console.warn("[7TV] Could not resolve user ID"); }

  if (userId) {
    try {
      const res  = await fetch(`https://7tv.io/v3/users/twitch/${userId}`);
      const data = await res.json();
      for (const e of (data?.emote_set?.emotes || [])) registerEmote(e);
    } catch (e) { console.warn("[7TV] Channel emotes failed:", e.message); }
  }
  emotesReady = true;
}

// ═══════════════════════════════════════════════════════════════
// NATIVE TWITCH EMOTES
// ═══════════════════════════════════════════════════════════════
// The IRC "emotes" tag gives us: emoteID:start-end,start-end/emoteID2:...
// We extract IDs and ranges, render images from the Twitch CDN.

const TWITCH_EMOTE_CDN = "https://static-cdn.jtvnw.net/emoticons/v2";

// Parse IRC emote tag → array of { id, start, end }
function parseTwitchEmoteTag(tag) {
  const entries = [];
  if (!tag) return entries;
  for (const part of tag.split("/")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const id     = part.slice(0, colon);
    const ranges = part.slice(colon + 1).split(",");
    for (const range of ranges) {
      const [s, e] = range.split("-").map(Number);
      entries.push({ id, start: s, end: e });
    }
  }
  // Sort by start position so we can walk through the message
  return entries.sort((a, b) => a.start - b.start);
}

// Render a message with both native Twitch emotes AND 7TV emotes.
function renderMessageText(text, twitchEmoteTag) {
  const twitchEmotes = parseTwitchEmoteTag(twitchEmoteTag);

  // If no native emotes and no 7TV, fast path
  if (twitchEmotes.length === 0 && !emotesReady) return esc(text);

  // Build character-level map of Twitch emote coverage
  // so we can render the exact image for each native emote position
  // and fall through to 7TV for uncovered words.
  if (twitchEmotes.length === 0 && emotesReady) {
    // Pure 7TV path (faster)
    return render7TVOnly(text);
  }

  // Mixed path — walk through text using both sources
  let html     = "";
  let pos      = 0;
  let twIdx    = 0;   // pointer into twitchEmotes array

  // Helper: flush plain text range through 7TV tokeniser
  function flush7TV(substr) {
    html += render7TVOnly(substr);
  }

  while (pos < text.length) {
    const te = twitchEmotes[twIdx];
    if (!te || pos < te.start) {
      // Text before next Twitch emote — run through 7TV
      const end = te ? te.start : text.length;
      flush7TV(text.slice(pos, end));
      pos = end;
    } else {
      // Twitch native emote
      const word = text.slice(te.start, te.end + 1);
      html += `<img class="chat-emote" src="${TWITCH_EMOTE_CDN}/${te.id}/default/dark/1.0" `
            + `srcset="${TWITCH_EMOTE_CDN}/${te.id}/default/dark/1.0 1x, ${TWITCH_EMOTE_CDN}/${te.id}/default/dark/2.0 2x" `
            + `alt="${esc(word)}" loading="lazy" `
            + `data-emote-source="twitch" data-emote-id="${esc(te.id)}" data-emote-name="${esc(word)}">`;
      pos = te.end + 1;
      twIdx++;
    }
  }
  return html;
}

// 7TV-only renderer: tokenise by whitespace, look up each word
function render7TVOnly(text) {
  if (!text) return "";
  const tokens = text.split(/(\s+)/);
  let html          = "";
  let lastEmoteHtml = null;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (lastEmoteHtml) { html += lastEmoteHtml; lastEmoteHtml = null; }
      html += esc(token);
      continue;
    }
    const emote = emotesReady ? emoteMap.get(token) : null;
    if (!emote) {
      if (lastEmoteHtml) { html += lastEmoteHtml; lastEmoteHtml = null; }
      html += esc(token);
    } else {
      const img = `<img class="chat-emote${emote.animated ? " animated" : ""}" `
                + `src="${emote.url1x}" srcset="${emote.url1x} 1x, ${emote.url2x} 2x" `
                + `alt="${esc(emote.name)}" loading="lazy" `
                + `data-emote-source="7tv" data-emote-id="${esc(emote.id)}" data-emote-name="${esc(emote.name)}">`;
      if (emote.zeroWidth && lastEmoteHtml) {
        html += `<span class="emote-stack">${lastEmoteHtml}<span class="emote-zero-width">${img}</span></span>`;
        lastEmoteHtml = null;
      } else {
        if (lastEmoteHtml) { html += lastEmoteHtml; lastEmoteHtml = null; }
        lastEmoteHtml = img;
      }
    }
  }
  if (lastEmoteHtml) html += lastEmoteHtml;
  return html;
}

// ═══════════════════════════════════════════════════════════════
// IRC CHAT — TWITCH (justinfan anonymous)
// ═══════════════════════════════════════════════════════════════

let ircWs       = null;
let chatPaused  = false;
let showTsMode  = false;
const MAX_MSGS  = 150;

// Fresh anonymous nick per connection — Twitch can drop repeat justinfan
// connections that share a nick, so don't cache one at module load.
function makeAnonNick() {
  return `justinfan${Math.floor(Math.random() * 899999) + 100000}`;
}

// Exponential-backoff reconnect: 5s, 10s, 20s, 40s, capped at 60s, ±20% jitter.
// Reset to step 0 after a successful subscription/join so a single failed reconnect
// doesn't permanently slow down all future reconnects.
let ircBackoffStep  = 0;
let kickBackoffStep = 0;
function nextBackoffMs(step) {
  const base = Math.min(60000, 5000 * Math.pow(2, step));
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

function startChat() {
  if (!channel || platform !== "twitch") {
    chatStatus.textContent = gvI18n("chatErrNoChannel");
    return;
  }
  if (ircWs) { ircWs.close(); ircWs = null; }
  chatStatus.textContent = gvI18n("chatStatusConnecting");

  const ws = new WebSocket(TWITCH_IRC_WS);
  ircWs = ws;

  ws.onopen = () => {
    ws.send(`NICK ${makeAnonNick()}`);
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
    ws.send(`JOIN #${channel.toLowerCase()}`);
  };

  ws.onmessage = e => {
    for (const line of e.data.split("\r\n")) {
      if (line) handleIrcLine(line);
    }
  };

  ws.onerror = () => { chatStatus.textContent = gvI18n("chatStatusError"); };

  ws.onclose = () => {
    chatStatus.textContent = gvI18n("chatStatusDisconnected");
    const delay = nextBackoffMs(ircBackoffStep++);
    setTimeout(() => { if (document.visibilityState !== "hidden" && chatVisible) startChat(); }, delay);
  };
}

// IRCv3 tag value unescape: \: → ;  \s → space  \\ → \  \r → CR  \n → LF
// https://ircv3.net/specs/extensions/message-tags
function unescapeIrcTagValue(v) {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      const next = v[i + 1];
      out += next === ":" ? ";"
           : next === "s" ? " "
           : next === "\\" ? "\\"
           : next === "r" ? "\r"
           : next === "n" ? "\n"
           : next;
      i++;
    } else {
      out += v[i];
    }
  }
  return out;
}

function parseTags(str) {
  const map = {};
  if (!str) return map;
  for (const p of str.split(";")) {
    const eq = p.indexOf("=");
    if (eq === -1) { map[p] = true; }
    else           { map[p.slice(0, eq)] = unescapeIrcTagValue(p.slice(eq + 1)); }
  }
  return map;
}

const CHAT_COLORS = [
  "#FF4500","#2E8B57","#DAA520","#FF69B4","#1E90FF",
  "#00CED1","#9400D3","#FF8C00","#32CD32","#DC143C",
  "#8B008B","#20B2AA","#FF6347","#7B68EE","#00FA9A",
];

function usernameColor(tags, username) {
  if (tags.color && tags.color !== "") return tags.color;
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) | 0;
  return CHAT_COLORS[Math.abs(h) % CHAT_COLORS.length];
}

function esc(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function nowTs() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// Ring buffer of recent chat events, replayed when the user toggles chat back on
// so the panel doesn't appear to "start over" on every off → on.
const chatHistory = [];   // { html, isNotice }

// Coalesce auto-scrolls so a burst of incoming chat (e.g. raid spam) does
// only one forced layout per animation frame instead of one per message.
let scrollPending = false;
function scheduleScrollToBottom() {
  if (scrollPending || chatPaused) return;
  scrollPending = true;
  requestAnimationFrame(() => {
    scrollPending = false;
    if (!chatPaused) chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function appendChatMsg(html, isNotice = false) {
  chatHistory.push({ html, isNotice });
  if (chatHistory.length > MAX_MSGS) chatHistory.shift();

  const el = document.createElement("div");
  el.className = isNotice ? "chat-notice" : "chat-msg";
  el.innerHTML = html;
  chatMessages.appendChild(el);
  if (chatMessages.children.length > MAX_MSGS)
    chatMessages.removeChild(chatMessages.firstChild);
  scheduleScrollToBottom();
}

function replayChatHistory() {
  // Render the buffer directly into the DOM without going back through appendChatMsg
  // (which would push duplicates into the ring buffer).
  const frag = document.createDocumentFragment();
  for (const { html, isNotice } of chatHistory) {
    const el = document.createElement("div");
    el.className = isNotice ? "chat-notice" : "chat-msg";
    el.innerHTML = html;
    frag.appendChild(el);
  }
  chatMessages.innerHTML = "";
  chatMessages.appendChild(frag);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderBadges(str) {
  if (!str) return "";
  const icons = { broadcaster:"🔴", moderator:"⚔️", subscriber:"⭐", partner:"✓", vip:"💎", staff:"🔧" };
  let out = "";
  for (const badge of str.split(",")) {
    const name = badge.split("/")[0];
    if (icons[name]) out += `<span title="${esc(name)}" style="font-size:10px;margin-right:2px">${icons[name]}</span>`;
  }
  return out;
}

function handleIrcLine(line) {
  if (line.startsWith("PING")) { ircWs?.send("PONG :tmi.twitch.tv"); return; }

  let rest = line;
  let tags  = {};
  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ");
    tags = parseTags(rest.slice(1, sp));
    rest = rest.slice(sp + 1);
  }
  if (rest.startsWith(":")) rest = rest.slice(rest.indexOf(" ") + 1);

  const sp      = rest.indexOf(" ");
  const command = sp === -1 ? rest : rest.slice(0, sp);
  const params  = sp === -1 ? ""   : rest.slice(sp + 1);

  switch (command) {
    case "001":
    case "JOIN":
      chatStatus.textContent = "";
      ircBackoffStep = 0;   // reset on successful join — one bad reconnect shouldn't slow future ones
      break;

    case "PRIVMSG": {
      const ci   = params.indexOf(":");
      if (ci === -1) break;
      const text  = params.slice(ci + 1);
      const name  = tags["display-name"] || "?";
      const color = usernameColor(tags, name.toLowerCase());
      const ts    = showTsMode ? `<span class="ts">${nowTs()}</span>` : "";
      appendChatMsg(
        `${ts}${renderBadges(tags.badges)}<span class="username" style="color:${esc(color)}">${esc(name)}</span>` +
        `<span style="color:#bbb">: </span><span class="msg-text">${renderMessageText(text, tags["emotes"] || "")}</span>`
      );
      break;
    }

    case "USERNOTICE": {
      const sys  = tags["system-msg"] || "";   // already unescaped by parseTags
      const type = tags["msg-id"] || "";
      const icons= { sub:"⭐", resub:"⭐", subgift:"🎁", raid:"⚔️", ritual:"🔮" };
      if (sys) appendChatMsg(`${icons[type] || "📣"} ${esc(sys)}`, true);
      break;
    }

    case "NOTICE": {
      const ci  = params.indexOf(":");
      appendChatMsg(`ℹ️ ${esc(ci !== -1 ? params.slice(ci + 1) : params)}`, true);
      break;
    }

    case "CLEARCHAT":
      if (!params.includes(":")) appendChatMsg(esc(gvI18n("chatNoticeCleared")), true);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// KICK CHAT — Pusher WebSocket (public app key)
// ═══════════════════════════════════════════════════════════════

let kickWs              = null;
let kickPusherSock      = null;  // raw socket
let kickChannelId       = null;
let kickLastGoodKeyIdx  = 0;     // remember which Pusher key actually worked, so reconnects don't always re-try the dead one first

async function fetchKickChannelId() {
  // Pusher needs the CHATROOM ID (data.chatroom.id), not the channel ID (data.id) — they differ.
  // Try v2 first for fresher data shape, fall back to v1.
  for (const url of [
    `https://kick.com/api/v2/channels/${channel}`,
    `https://kick.com/api/v1/channels/${channel}`
  ]) {
    try {
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) continue;
      const data = await res.json();
      // chatroom.id is what Pusher channel "chatrooms.{id}.v2" expects
      const id = data?.chatroom?.id ?? data?.chatroom_id ?? null;
      if (id) return id;
    } catch (_) { continue; }
  }
  throw new Error("Could not resolve Kick chatroom ID");
}

function startKickChat() {
  if (!channel || platform !== "kick") return;
  chatStatus.textContent = gvI18n("chatStatusKickConnecting");

  fetchKickChannelId().then(id => {
    kickChannelId = id;
    openKickPusher(id, kickLastGoodKeyIdx);
  }).catch(e => {
    chatStatus.textContent = gvI18n("chatStatusErrorWith", e.message);
  });
}

function openKickPusher(channelId, keyIndex = 0) {
  if (kickWs) { kickWs.close(); kickWs = null; }

  const key = KICK_PUSHER_KEYS[keyIndex];
  const wsUrl = `wss://ws-us2.pusher.com/app/${key}?protocol=7&client=js&version=7.6.0&flash=false`;
  const ws = new WebSocket(wsUrl);
  kickWs = ws;

  ws.onopen = () => {};   // wait for connection_established before subscribing

  ws.onmessage = e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    const event = msg.event || "";
    // Pusher data field can be a JSON string or an object
    const data = typeof msg.data === "string"
      ? (() => { try { return JSON.parse(msg.data); } catch { return {}; } })()
      : (msg.data || {});

    switch (event) {
      case "pusher:connection_established":
        // Subscribe to both channel formats for maximum compatibility
        ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${channelId}.v2` } }));
        chatStatus.textContent = "";
        break;

      case "pusher:error":
        // If error on first key, try the fallback key
        if (keyIndex < KICK_PUSHER_KEYS.length - 1) {
          console.warn(`[Kick] Pusher key ${key} failed, trying fallback...`);
          openKickPusher(channelId, keyIndex + 1);
        } else {
          chatStatus.textContent = gvI18n("chatStatusErrorWith", data.message || "connection refused");
        }
        break;

      case "pusher:ping":
        ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        break;

      case "pusher_internal:subscription_succeeded":
        kickLastGoodKeyIdx = keyIndex;   // remember which key won; future reconnects start here
        kickBackoffStep    = 0;          // reset reconnect backoff on a successful subscription
        chatStatus.textContent = "";
        break;

      // Pusher event names use PHP-style "App\Events\…" with literal backslashes.
      // The string literal needs the backslashes escaped or JS silently drops them.
      case "App\\Events\\ChatMessageEvent":
      case "App\\Events\\ChatMessageSentEvent":
      case "ChatMessageEvent":
        handleKickMessage(data);
        break;

      default:
        // Defence-in-depth: if Kick adds a new chat-message event name, still try to render it.
        if (event.includes("ChatMessage")) handleKickMessage(data);
        break;
    }
  };

  ws.onerror = () => { chatStatus.textContent = gvI18n("chatStatusKickError"); };

  ws.onclose = () => {
    chatStatus.textContent = gvI18n("chatStatusKickDisconnected");
    const delay = nextBackoffMs(kickBackoffStep++);
    setTimeout(() => {
      if (document.visibilityState !== "hidden" && chatVisible && kickChannelId)
        openKickPusher(kickChannelId, kickLastGoodKeyIdx);  // reconnect with the last working key
    }, delay);
  };
}

// Kick chat encodes native emotes inline as `[emote:<id>:<name>]`.
// Walk the text, swap each token for an <img>, and run remaining segments
// through the 7TV renderer so 7TV emotes still work in Kick chat too.
const KICK_EMOTE_RE  = /\[emote:(\d+):([^\]]+)\]/g;
const KICK_EMOTE_CDN = "https://files.kick.com/emotes";

function renderKickMessageText(text) {
  if (!text) return "";
  let html = "";
  let pos  = 0;
  for (const m of text.matchAll(KICK_EMOTE_RE)) {
    if (m.index > pos) html += render7TVOnly(text.slice(pos, m.index));
    const id   = m[1];
    const name = m[2];
    html += `<img class="chat-emote" src="${KICK_EMOTE_CDN}/${id}/fullsize" `
          + `alt="${esc(name)}" loading="lazy" `
          + `data-emote-source="kick" data-emote-id="${esc(id)}" data-emote-name="${esc(name)}">`;
    pos = m.index + m[0].length;
  }
  if (pos < text.length) html += render7TVOnly(text.slice(pos));
  return html;
}

function handleKickMessage(data) {
  // Kick API has evolved — handle both v1 (data.message + data.user) and v2 (data.sender + data.content) shapes
  // v2 shape: { sender: { username, identity: { color } }, content }
  // v1 shape: { message: { message }, user: { username } }
  let username, text, color;

  if (data?.sender) {
    // v2 (current)
    username = data.sender?.username || data.sender?.slug || "?";
    text     = data.content || "";
    color    = data.sender?.identity?.color || "#bf94ff";
  } else if (data?.user || data?.message) {
    // v1 (legacy)
    username = data.user?.username || data.user?.slug || "?";
    text     = data.message?.message || data.message?.content || data.content || "";
    color    = "#bf94ff";
  } else {
    return;  // unrecognised shape — skip silently
  }

  if (!text) return;

  const ts = showTsMode ? `<span class="ts">${nowTs()}</span>` : "";
  appendChatMsg(
    `${ts}<span class="username" style="color:${esc(color)}">${esc(username)}</span>` +
    `<span style="color:#bbb">: </span><span class="msg-text">${renderKickMessageText(text)}</span>`
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEWER COUNT — polled every 60s, displayed next to chat title
// ═══════════════════════════════════════════════════════════════

let viewerCountTimer = null;

function formatCount(n) {
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

async function fetchTwitchViewerCount() {
  // Free-form GQL — works with the browser client ID we already use.
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-ID": TWITCH_CLIENT_ID },
    body: JSON.stringify({ query: `{ user(login:"${channel.toLowerCase()}") { stream { viewersCount } } }` })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.user?.stream?.viewersCount ?? null;
}

async function fetchKickViewerCount() {
  const res = await fetch(`https://kick.com/api/v2/channels/${channel}`, {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.livestream?.viewer_count ?? data?.livestream?.viewers ?? null;
}

async function updateViewerCount() {
  // Skip when the tab is hidden — saves a fetch every 60s in backgrounded tabs.
  if (document.visibilityState === "hidden") return;
  try {
    const n = platform === "twitch"
      ? await fetchTwitchViewerCount()
      : await fetchKickViewerCount();
    chatViewerCnt.textContent = (typeof n === "number") ? gvI18n("chatViewerCountFmt", formatCount(n)) : "";
  } catch (_) {
    chatViewerCnt.textContent = "";
  }
}

function startViewerCountPolling() {
  updateViewerCount();
  clearInterval(viewerCountTimer);
  viewerCountTimer = setInterval(updateViewerCount, 60_000);
  // When the user comes back to the tab, refresh immediately instead of
  // showing a stale value for up to 60s.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateViewerCount();
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════════════

// ── Play / Pause ────────────────────────────────────────────────
// Toggles videoEl.paused. Subscribes to the video's own play/pause
// events so the UI stays correct when state is changed elsewhere
// (spacebar shortcut, autoplay on stream start, OS media keys, etc.)

const PLAY_PATH  = "M8 5v14l11-7z";
const PAUSE_PATH = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

function syncPlayUI() {
  const paused = videoEl.paused;
  playLabel.textContent = paused ? gvI18n("ctrlPlay")  : gvI18n("ctrlPause");
  playIcon.setAttribute("d", paused ? PLAY_PATH : PAUSE_PATH);
  btnPlay.classList.toggle("active", !paused);
}

btnPlay.addEventListener("click", () => {
  if (videoEl.paused) videoEl.play().catch(() => {});
  else                videoEl.pause();
});

videoEl.addEventListener("play",  syncPlayUI);
videoEl.addEventListener("pause", syncPlayUI);

// ── Mute ────────────────────────────────────────────────────────
const MUTED_PATH   = "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";
const UNMUTED_PATH = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";

function updateMuteIcon(muted) {
  document.getElementById("mute-icon-path").setAttribute("d", muted ? MUTED_PATH : UNMUTED_PATH);
}

// Volume model:
//   logicalVolume   — 0..100, what the slider position represents
//   logicalMuted    — explicit mute toggle (independent of slider position)
//
// We route audio through a Web Audio GainNode so we can:
//   (a) apply a perceptual (squared) curve — lower slider positions become
//       much quieter, giving fine control at low volume
//   (b) BOOST above the native 100% max, up to 1.5× — useful for quiet streams
//
// If Web Audio init fails (rare — usually CORS), we fall back to native
// linear volume so audio keeps working.
const VOLUME_MAX_GAIN = 1.5;
let logicalVolume = 100;
let logicalMuted  = false;
let audioCtx      = null;
let gainNode      = null;

function ensureAudioGraph() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return !!gainNode;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(videoEl);
    gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    return true;
  } catch (e) {
    console.warn("[Audio] Web Audio init failed, using native volume:", e?.message);
    audioCtx = null;
    gainNode = null;
    return false;
  }
}

function applyAudio() {
  const norm = logicalMuted ? 0 : logicalVolume / 100;
  if (ensureAudioGraph() && gainNode) {
    // Squared curve, scaled so slider 100 = 1.5× (boost above native max).
    gainNode.gain.value = norm * norm * VOLUME_MAX_GAIN;
    videoEl.volume = 1.0;
    videoEl.muted  = false;
  } else {
    videoEl.volume = norm;
    videoEl.muted  = norm === 0;
  }
}

const volumeTooltip = document.getElementById("volume-tooltip");

function syncMuteUI() {
  const muted = logicalMuted || logicalVolume === 0;
  muteLabel.textContent = muted ? gvI18n("ctrlUnmute") : gvI18n("ctrlMute");
  btnMute.classList.toggle("active", muted);
  updateMuteIcon(muted);
  const displayed = muted ? 0 : logicalVolume;
  volumeSlider.value = displayed;
  // Native browser tooltip is more verbose so it doesn't duplicate the pill
  // (which already reads just "40%").
  volumeSlider.title = `${gvI18n("ctrlVolumeTitle")}: ${displayed}%`;
  volumeTooltip.textContent = `${displayed}%`;
}

// Show the volume tooltip while dragging even if the cursor strays off the
// slider's hover area (range inputs don't keep :hover during drag).
volumeSlider.addEventListener("pointerdown", () => volumeTooltip.classList.add("dragging"));
document.addEventListener("pointerup",       () => volumeTooltip.classList.remove("dragging"));

btnMute.addEventListener("click", () => {
  logicalMuted = !logicalMuted;
  applyAudio();
  syncMuteUI();
  savePrefs();
});

volumeSlider.addEventListener("input", () => {
  logicalVolume = parseInt(volumeSlider.value, 10);
  logicalMuted  = (logicalVolume === 0);
  applyAudio();
  syncMuteUI();
  savePrefs();
});

// ── Fit / Fill ────────────────────────────────────────────────
let isCover = false;
btnFit.addEventListener("click", () => {
  isCover = !isCover;
  videoSide.classList.toggle("cover", isCover);
  btnFit.classList.toggle("active", isCover);
  fitLabel.textContent = isCover ? gvI18n("ctrlFill") : gvI18n("ctrlFit");
});

// ── Picture-in-Picture ────────────────────────────────────────
btnPip.addEventListener("click", async () => {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      btnPip.classList.remove("active");
    } else {
      await videoEl.requestPictureInPicture();
      btnPip.classList.add("active");
    }
  } catch (_) {}
});
videoEl.addEventListener("leavepictureinpicture", () => btnPip.classList.remove("active"));

// ── Stats overlay ─────────────────────────────────────────────
btnStats.addEventListener("click", () => {
  const visible = statsPanel.classList.toggle("visible");
  btnStats.classList.toggle("active", visible);
  if (visible) startStatsTicking();
  else         stopStatsTicking();
});

// ── Chat toggle ───────────────────────────────────────────────
let chatVisible    = true;
let chatToggleTimer = null;   // debounce rapid double-clicks so we don't race-open two WS connections

btnChat.addEventListener("click", () => {
  chatVisible = !chatVisible;
  chatSide.classList.toggle("collapsed", !chatVisible);
  btnChat.classList.toggle("active", chatVisible);

  // Always tear down current sockets immediately on toggle (cheap, idempotent).
  if (ircWs)  { ircWs.onclose  = null; ircWs.close();  ircWs  = null; }
  if (kickWs) { kickWs.onclose = null; kickWs.close(); kickWs = null; }

  // If reopening, instantly replay the buffered history (so the panel isn't blank
  // while we reconnect), then debounce the WS reopen so rapid clicks don't race.
  clearTimeout(chatToggleTimer);
  if (chatVisible) {
    if (chatHistory.length) replayChatHistory();
    chatToggleTimer = setTimeout(() => {
      if (!chatVisible) return;   // user toggled off again before the timer fired
      if (platform === "twitch") startChat();
      else                       startKickChat();
    }, 150);
  }
});

// ── Fullscreen ────────────────────────────────────────────────
const FS_ENTER = "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z";
const FS_EXIT  = "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z";

// Fullscreen the #app grid container itself rather than <html>, so the
// existing grid layout (topbar | video | controls) scales to fill the
// screen with no extra positioning logic — controls stay visible at the
// bottom row of the grid.
async function enterFullscreen() {
  try { await document.getElementById("app").requestFullscreen(); } catch (_) {}
}
async function exitFullscreen() {
  try { await document.exitFullscreen(); } catch (_) {}
}

btnFs.addEventListener("click", () => {
  document.fullscreenElement ? exitFullscreen() : enterFullscreen();
});

// Click on video area: pause/play after a short 150ms delay so a double-click
// (which toggles fullscreen) cancels the pause first and the video doesn't
// blink paused on its way to fullscreen. Skipped in VOD mode — native
// <video controls> owns click behaviour there.
let videoClickTimer = null;
videoSide.addEventListener("click", e => {
  if (isVod) return;
  if (e.target.closest("#overlay, #stats-panel")) return;
  if (videoClickTimer) return;   // already pending — let dblclick take it
  videoClickTimer = setTimeout(() => {
    videoClickTimer = null;
    if (videoEl.paused) videoEl.play().catch(() => {});
    else                videoEl.pause();
  }, 150);
});

// Double-click on video area toggles fullscreen and cancels any pending pause.
videoSide.addEventListener("dblclick", () => {
  if (videoClickTimer) { clearTimeout(videoClickTimer); videoClickTimer = null; }
  document.fullscreenElement ? exitFullscreen() : enterFullscreen();
});

// ── Fullscreen idle — controls visible on entry + any activity, hide after 2s ──
let fsIdleTimer = null;

function nudgeFsIdle() {
  if (!document.fullscreenElement) return;
  document.body.classList.remove("fs-idle");
  clearTimeout(fsIdleTimer);
  fsIdleTimer = setTimeout(() => {
    if (document.fullscreenElement) document.body.classList.add("fs-idle");
  }, 2000);
}

document.addEventListener("fullscreenchange", () => {
  const isFs = !!document.fullscreenElement;
  // Toggle the body class FIRST so the fullscreen-mode CSS (overlay positioning,
  // backdrop, etc.) is applied before we run the idle-timer logic.
  document.body.classList.toggle("in-fullscreen", isFs);

  btnFs.classList.toggle("active", isFs);
  fsLabel.textContent = isFs ? gvI18n("ctrlExitFullscreen") : gvI18n("ctrlFullscreen");
  document.getElementById("fs-icon").setAttribute("d", isFs ? FS_EXIT : FS_ENTER);
  if (isFs) {
    // On entry: show controls and start the auto-hide timer immediately,
    // even if the user entered FS via the F key (no mouse movement to trigger it).
    nudgeFsIdle();
  } else {
    // On exit: remove idle class and cancel any pending hide.
    document.body.classList.remove("fs-idle");
    clearTimeout(fsIdleTimer);
  }
});

// Any user activity in fullscreen resets the idle timer.
// Throttle the mousemove path so a fast cursor doesn't cause hundreds of
// clearTimeout/setTimeout pairs per second — once every 150ms is plenty
// for "did the user just move the mouse?" detection.
let lastNudgeAt = 0;
function throttledNudge() {
  const now = performance.now();
  if (now - lastNudgeAt < 150) return;
  lastNudgeAt = now;
  nudgeFsIdle();
}
document.addEventListener("mousemove", throttledNudge);
document.addEventListener("keydown",   nudgeFsIdle);

// ── Timestamps ────────────────────────────────────────────────
btnTimestamps.addEventListener("click", () => {
  showTsMode = !showTsMode;
  btnTimestamps.classList.toggle("active", showTsMode);
  savePrefs();
});

// ═══════════════════════════════════════════════════════════════
// EMOTE HOVER TOOLTIP
// ═══════════════════════════════════════════════════════════════
// Single shared tooltip element, positioned by mouseover events on .chat-emote.
// Event delegation on #chat-messages so replayed history and brand-new messages
// both work without per-element listeners.

const emoteTooltip = document.getElementById("emote-tooltip");

function emoteHoverHtml(img) {
  const name   = img.dataset.emoteName   || img.alt || "?";
  const source = img.dataset.emoteSource || "";
  const id     = img.dataset.emoteId;

  // Pick the largest preview image we can for each source.
  let preview = img.src;
  let label   = "";
  let cls     = "";
  if (source === "twitch" && id) {
    preview = `${TWITCH_EMOTE_CDN}/${id}/default/dark/3.0`;
    label   = "Twitch";
    cls     = "twitch";
  } else if (source === "kick" && id) {
    preview = `${KICK_EMOTE_CDN}/${id}/fullsize`;
    label   = "Kick";
    cls     = "kick";
  } else if (source === "7tv" && id) {
    preview = `https://cdn.7tv.app/emote/${id}/4x.webp`;
    label   = "7TV";
    cls     = "sevenTV";
  } else {
    label   = source.toUpperCase() || "Emote";
  }

  return `<img src="${esc(preview)}" alt=""><div class="et-name">${esc(name)}</div><div class="et-source ${cls}">${esc(label)}</div>`;
}

function positionTooltip(e) {
  // Anchor above the cursor; flip below if there's no room.
  const margin = 12;
  const rect   = emoteTooltip.getBoundingClientRect();
  let x = e.clientX - rect.width / 2;
  let y = e.clientY - rect.height - margin;
  if (y < 4)  y = e.clientY + margin;
  if (x < 4)  x = 4;
  if (x + rect.width > window.innerWidth - 4) x = window.innerWidth - rect.width - 4;
  emoteTooltip.style.left = `${x}px`;
  emoteTooltip.style.top  = `${y}px`;
}

chatMessages.addEventListener("mouseover", e => {
  const img = e.target.closest(".chat-emote");
  if (!img) return;
  emoteTooltip.innerHTML = emoteHoverHtml(img);
  emoteTooltip.classList.add("visible");
  positionTooltip(e);
});

// Throttle tooltip reposition to one rAF — fast cursor movement was causing
// dozens of style writes per frame. One write per frame is plenty.
let tooltipMoveScheduled = false;
let tooltipLastEvent     = null;
chatMessages.addEventListener("mousemove", e => {
  if (!emoteTooltip.classList.contains("visible")) return;
  tooltipLastEvent = e;
  if (tooltipMoveScheduled) return;
  tooltipMoveScheduled = true;
  requestAnimationFrame(() => {
    tooltipMoveScheduled = false;
    if (emoteTooltip.classList.contains("visible") && tooltipLastEvent) {
      positionTooltip(tooltipLastEvent);
    }
  });
});

chatMessages.addEventListener("mouseout", e => {
  const img = e.target.closest(".chat-emote");
  if (!img) return;
  // Hide unless we're moving onto another emote (mouseover will re-show)
  emoteTooltip.classList.remove("visible");
});

// Note: the single chatMessages scroll listener (further down, in CHAT SCROLL)
// also hides the emote tooltip — both behaviours live in one handler now.

// ═══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════
// Triggered on document keydown. Ignored when an input/textarea/contentEditable
// has focus so users can still type into the (eventual) chat input.

document.addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

  switch (e.key) {
    case "m": case "M": btnMute.click(); e.preventDefault(); break;
    case "f": case "F": btnFs.click();   e.preventDefault(); break;
    case "c": case "C": if (!isVod) btnChat.click(); e.preventDefault(); break;
    case "t": case "T": if (!isVod) btnTimestamps.click(); e.preventDefault(); break;
    case "s": case "S": btnStats.click(); e.preventDefault(); break;
    case "+": case "=": btnFontUp.click();   e.preventDefault(); break;
    case "-": case "_": btnFontDown.click(); e.preventDefault(); break;
    case " ":
      if (videoEl.paused) videoEl.play().catch(() => {});
      else                videoEl.pause();
      e.preventDefault();
      break;
  }
});

// ═══════════════════════════════════════════════════════════════
// CHAT SCROLL
// ═══════════════════════════════════════════════════════════════

chatMessages.addEventListener("scroll", () => {
  // Hide the emote tooltip on scroll — the cursor stays put but the
  // hovered image moves out from under it.
  emoteTooltip.classList.remove("visible");

  // Track whether the user has scrolled away from the bottom; pauses
  // auto-scroll-on-new-message if they have, and shows the jump button.
  const dist = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
  chatPaused = dist > 80;
  scrollBtn.classList.toggle("visible", chatPaused);
});

scrollBtn.addEventListener("click", () => {
  chatPaused = false;
  chatMessages.scrollTop = chatMessages.scrollHeight;
  scrollBtn.classList.remove("visible");
});

// ═══════════════════════════════════════════════════════════════
// PREFS — chat width, font size, volume, timestamps
// ═══════════════════════════════════════════════════════════════

const CHAT_MIN_W    = 180;
const CHAT_MAX_W    = 600;
const FONT_MIN      = 9;
const FONT_MAX      = 18;
const FONT_DEFAULT  = 12;
const WIDTH_DEFAULT = 320;

let currentFontSize = FONT_DEFAULT;

// Per-channel volume — each ghosted streamer remembers its own loudness so
// the user doesn't have to re-tune for noisy vs. quiet creators.
function getChannelVolume() {
  if (!channel) return null;
  try {
    const v = localStorage.getItem(`gv_vol_${platform}_${channel}`);
    if (v === null) return null;
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  } catch {}
  return null;
}
function setChannelVolume(v) {
  if (!channel) return;
  try { localStorage.setItem(`gv_vol_${platform}_${channel}`, v); } catch {}
}

function savePrefs() {
  try {
    localStorage.setItem("gv_chat_width", chatSide.style.width);
    localStorage.setItem("gv_chat_fs",    currentFontSize);
    localStorage.setItem("gv_ts",         showTsMode ? "1" : "0");
    const v = logicalMuted ? 0 : logicalVolume;
    localStorage.setItem("gv_volume", v);   // global "default for new channels"
    setChannelVolume(v);                    // per-channel override for this stream
  } catch (_) {}
}

function loadPrefs() {
  const DEFAULT_VOL = 40;
  let w = WIDTH_DEFAULT, fs = FONT_DEFAULT, vol = DEFAULT_VOL, ts = false;
  try {
    const sw = localStorage.getItem("gv_chat_width");
    const sf = localStorage.getItem("gv_chat_fs");
    const sv = localStorage.getItem("gv_volume");
    const st = localStorage.getItem("gv_ts");
    if (sw) { const n = parseInt(sw); if (n >= CHAT_MIN_W && n <= CHAT_MAX_W) w   = n; }
    if (sf) { const n = parseInt(sf); if (n >= FONT_MIN   && n <= FONT_MAX)   fs  = n; }
    if (sv) { const n = parseInt(sv); if (n >= 0          && n <= 100)        vol = n; }
    if (st) ts = st === "1";
  } catch (_) {}
  // Per-channel value wins over the global default if it exists.
  const channelVol = getChannelVolume();
  if (channelVol !== null) vol = channelVol;
  return { w, fs, vol, ts };
}

function applyChatWidth(px) {
  px = Math.max(CHAT_MIN_W, Math.min(CHAT_MAX_W, px));
  chatSide.style.width    = px + "px";
  chatSide.style.minWidth = px + "px";
  document.documentElement.style.setProperty("--chat-w", px + "px");
}

function applyFontSize(px) {
  px = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
  currentFontSize = px;
  document.documentElement.style.setProperty("--chat-fs", px + "px");
  chatFontLabel.textContent = px + "px";
  btnFontDown.disabled = px <= FONT_MIN;
  btnFontUp.disabled   = px >= FONT_MAX;
}

btnFontDown.addEventListener("click", () => { applyFontSize(currentFontSize - 1); savePrefs(); });
btnFontUp.addEventListener("click",   () => { applyFontSize(currentFontSize + 1); savePrefs(); });

// ── Drag-to-resize handle ─────────────────────────────────────
let isDragging = false, dragStartX = 0, dragStartW = 0;

resizeHandle.addEventListener("mousedown", e => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartW = chatSide.getBoundingClientRect().width;
  resizeHandle.classList.add("dragging");
  document.body.style.cursor     = "col-resize";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

document.addEventListener("mousemove", e => {
  if (!isDragging) return;
  applyChatWidth(dragStartW + (dragStartX - e.clientX));
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  resizeHandle.classList.remove("dragging");
  document.body.style.cursor     = "";
  document.body.style.userSelect = "";
  savePrefs();
});

// ── Init ─────────────────────────────────────────────────────
(function init() {
  const { w, fs, vol, ts } = loadPrefs();
  applyChatWidth(w);
  applyFontSize(fs);

  showTsMode = ts;
  if (ts) btnTimestamps.classList.add("active");

  setTimeout(() => {
    logicalVolume = vol;
    logicalMuted  = (vol === 0);
    applyAudio();
    syncMuteUI();
    syncRefreshUI();
    syncPlayUI();
  }, 0);
})();

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

// VOD mode: hide live-only UI (chat, live dot, viewer count, chat toggle, ghost note),
// give the video native controls so the user can scrub.
if (isVod) {
  videoEl.controls = true;
  chatSide.classList.add("collapsed");
  chatVisible = false;
  btnChat.style.display = "none";
  liveDot.style.display = "none";
  document.getElementById("ghost-note").style.display = "none";
  // Replace the "Live" status label with a static "VOD" badge.
  statusText.textContent = gvI18n("modeVod");
}

startStream();

if (!isVod) {
  startViewerCountPolling();
  load7TVEmotes();
  if (platform === "twitch") startChat();
  else                       startKickChat();
}

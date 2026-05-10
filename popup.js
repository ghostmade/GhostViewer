// popup.js — channel list management

const PLATFORM_URLS = {
  twitch: "https://www.twitch.tv/",
  kick:   "https://www.kick.com/"
};

// Strip a pasted full URL down to just the channel slug
function extractChannelName(value) {
  value = value.trim();
  // Handle full URLs like https://twitch.tv/channelname
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 1) return parts[0].toLowerCase();
  } catch (_) {
    // Not a URL — treat as a plain name
  }
  return value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

// ── Notification mute state (per-channel bell icon) ──────────────────────────

async function getMuted() {
  const { gv_notif_muted } = await chrome.storage.local.get("gv_notif_muted");
  return gv_notif_muted || { twitch: [], kick: [] };
}

async function setMuted(platform, channel, muted) {
  const m = await getMuted();
  const list = m[platform] || [];
  if (muted && !list.includes(channel)) list.push(channel);
  if (!muted) m[platform] = list.filter(c => c !== channel);
  else        m[platform] = list;
  await chrome.storage.local.set({ gv_notif_muted: m });
}

// ── Channel list rendering ───────────────────────────────────────────────────

async function renderList(platform) {
  const channels = await Storage.getChannels();
  const muted    = await getMuted();
  const notifEnabled = !!(await chrome.storage.local.get("gv_notif_enabled")).gv_notif_enabled;
  const list = document.getElementById(`${platform}-list`);
  list.innerHTML = "";

  if (channels[platform].length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";

    const main = document.createElement("div");
    main.className   = "empty-line";
    main.textContent = gvI18n("popupListEmpty");

    const hint = document.createElement("div");
    hint.className   = "empty-hint";
    hint.textContent = gvI18n("popupListEmptyHint");

    empty.append(main, hint);
    list.appendChild(empty);
    return;
  }

  for (const channel of channels[platform]) {
    const item = document.createElement("div");
    item.className = "channel-item";
    item.dataset.channel = channel;

    const link = document.createElement("a");
    link.href   = PLATFORM_URLS[platform] + channel;
    link.target = "_blank";
    link.rel    = "noopener noreferrer";
    link.textContent = channel;

    // Bell icon — only meaningful when global notifications are enabled.
    // Filled bell = will notify, empty bell = muted for this channel.
    const isMuted = (muted[platform] || []).includes(channel);
    const bell = document.createElement("button");
    bell.className   = "btn-bell" + (isMuted ? " muted" : " active");
    bell.textContent = isMuted ? "🔕" : "🔔";
    bell.title       = isMuted ? gvI18n("popupBellMuted") : gvI18n("popupBellActive");
    bell.setAttribute("aria-label", bell.title);
    bell.dataset.platform = platform;
    bell.dataset.channel  = channel;
    bell.dataset.action   = "togglemute";
    if (!notifEnabled) bell.style.opacity = "0.4";

    const removeBtn = document.createElement("button");
    removeBtn.className   = "btn-remove";
    removeBtn.title       = gvI18n("popupRemoveTitle");
    removeBtn.setAttribute("aria-label", removeBtn.title);
    removeBtn.textContent = "×";
    removeBtn.dataset.platform = platform;
    removeBtn.dataset.channel  = channel;
    removeBtn.dataset.action   = "remove";

    item.appendChild(link);
    item.appendChild(bell);
    item.appendChild(removeBtn);
    list.appendChild(item);
  }
}

async function renderAll() {
  await renderList("twitch");
  await renderList("kick");
}

// ── Add buttons ──────────────────────────────────────────────────────────────

// Flash: snap to the colour (1000ms hold), then fade out over 0.45s via the
// .channel-item transition. Total visible: ~1.45s.
function flashChannel(platform, channel, kind) {
  const sel  = `#${platform}-list .channel-item[data-channel="${CSS.escape(channel)}"]`;
  const item = document.querySelector(sel);
  if (!item) return;
  const cls = kind === "duplicate" ? "flash-duplicate" : "flash-added";
  // Restart cleanly if the user re-adds the same channel quickly.
  item.classList.remove("flash-added", "flash-duplicate");
  void item.offsetWidth;
  item.classList.add(cls);
  setTimeout(() => item.classList.remove(cls), 1000);
}

document.querySelectorAll(".btn-add").forEach(btn => {
  btn.addEventListener("click", async () => {
    const platform = btn.dataset.platform;
    const input    = document.getElementById(`${platform}-input`);
    const raw      = input.value.trim();
    if (!raw) return;

    const channel = extractChannelName(raw);
    if (!channel) return;

    const wasAdded = await Storage.addChannel(platform, channel);
    input.value = "";
    await renderList(platform);
    flashChannel(platform, channel, wasAdded ? "added" : "duplicate");
    input.focus();
  });
});

// Allow Enter key in inputs
["twitch", "kick"].forEach(platform => {
  const input = document.getElementById(`${platform}-input`);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      document.querySelector(`.btn-add[data-platform="${platform}"]`).click();
    }
  });
});

// ── Click delegation: remove and bell-toggle buttons ────────────────────────

document.addEventListener("click", async e => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const action = t.dataset.action;
  if (!action) return;

  const { platform, channel } = t.dataset;
  if (action === "remove") {
    await Storage.removeChannel(platform, channel);
    await renderList(platform);
  } else if (action === "togglemute") {
    const muted = await getMuted();
    const isMuted = (muted[platform] || []).includes(channel);
    await setMuted(platform, channel, !isMuted);
    await renderList(platform);
  }
});

// ── Notification toggle ──────────────────────────────────────────────────────

const notifToggle = document.getElementById("notif-toggle");

async function loadNotifToggle() {
  const { gv_notif_enabled } = await chrome.storage.local.get("gv_notif_enabled");
  notifToggle.checked = !!gv_notif_enabled;
}

notifToggle.addEventListener("change", async () => {
  const enabled = notifToggle.checked;
  await chrome.storage.local.set({ gv_notif_enabled: enabled });
  // Re-render so bell icons update their dimmed state
  await renderAll();
});

// ── Init ─────────────────────────────────────────────────────────────────────

loadNotifToggle();
renderAll();

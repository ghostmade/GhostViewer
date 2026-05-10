// storage.js — shared channel list helpers
// Loaded via <script> tag from popup.html and via importScripts() from background.js.
// Single source of truth for the ghosted-channel list.
//
// Storage backend: chrome.storage.local (5MB cap).
// Was previously chrome.storage.sync (100KB / 8KB-per-key) — migration runs in background.js.

const Storage = {
  async getChannels() {
    const result = await chrome.storage.local.get("ghostChannels");
    return result.ghostChannels || { twitch: [], kick: [] };
  },

  // Returns true if the channel was newly added, false if it already existed
  // (or the input was blank). Lets the popup flash the row in either case
  // with different visuals.
  async addChannel(platform, channel) {
    const channels = await this.getChannels();
    const name = channel.toLowerCase().trim();
    if (!name) return false;
    if (channels[platform].includes(name)) return false;
    channels[platform].push(name);
    await chrome.storage.local.set({ ghostChannels: channels });
    return true;
  },

  async removeChannel(platform, channel) {
    const channels = await this.getChannels();
    channels[platform] = channels[platform].filter(c => c !== channel);
    await chrome.storage.local.set({ ghostChannels: channels });
  },

  async isGhosted(platform, channel) {
    const channels = await this.getChannels();
    return channels[platform].includes(channel.toLowerCase().trim());
  }
};

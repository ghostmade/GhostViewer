# GitHub repo setup — GhostViewer

Step-by-step guide to publish this project to GitHub and host the privacy policy at a public URL the Chrome Web Store will accept.

**Working directory throughout:** `c:\VSCodeProjects\GhostViewer`

---

## 1. Create the GitHub repo (web UI, ~2 minutes)

1. Sign in to <https://github.com>. (Free account is fine.)
2. Click **+** → **New repository** in the top-right.
3. Fill in:
   - **Owner** — your account.
   - **Repository name** — `GhostViewer` (recommended for URL clarity).
   - **Description** — *Watch Twitch and Kick streams without being counted as a viewer or seeing ads.*
   - **Visibility** — **Public** (required for the Chrome Web Store privacy-policy URL to work without auth).
   - **Initialize this repository with** — leave **all three checkboxes UNCHECKED** (we already have files locally; ticking them would create merge conflicts on the first push).
4. Click **Create repository**.
5. On the next page, copy the **HTTPS URL** under "Quick setup" — looks like `https://github.com/<yourname>/GhostViewer.git`. You'll need it in step 2.

---

## 2. Initialize git locally and push (~5 minutes)

Open a terminal in `c:\VSCodeProjects\GhostViewer`. Run these in order:

```bash
# In: c:\VSCodeProjects\GhostViewer

# Verify .gitignore is in place — should be (we created it).
# It excludes: .claude/, claude.md, design-backup-*/, _metadata/, *.zip
ls .gitignore

# Initialize the repo
git init
git branch -M main

# Stage everything not blocked by .gitignore. Review what's about to be committed:
git add -A
git status

# If anything looks like it shouldn't be in there (e.g. you see claude.md, _metadata,
# or design-backup folders in the green list), STOP and add it to .gitignore first,
# then re-run `git add -A`.

# First commit
git commit -m "Initial commit: GhostViewer v1.30"

# Connect to GitHub (use the URL you copied in step 1)
git remote add origin https://github.com/<yourname>/GhostViewer.git

# Push
git push -u origin main
```

If the push prompts for credentials, GitHub no longer accepts your password — you need either:
- A **personal access token** (Settings → Developer settings → Tokens → Generate new (classic), tick `repo` scope, copy the token, paste it as the password), OR
- **GitHub CLI** (`gh auth login`), which handles the token for you.

---

## 3. Get the public privacy policy URL (~30 seconds)

The simplest approach — **link directly to the rendered Markdown on GitHub**:

```
https://github.com/<yourname>/GhostViewer/blob/main/PRIVACY_POLICY.md
```

Open it in a browser to verify it renders correctly. Paste this URL into the Chrome Web Store dashboard's "Privacy policy URL" field.

That's it. No GitHub Pages setup needed.

### Optional: GitHub Pages for a cleaner URL

If you'd prefer `https://<yourname>.github.io/GhostViewer/` instead of a `/blob/main/` link:

1. Repo page → **Settings** → **Pages** (left sidebar).
2. **Source** → "Deploy from a branch".
3. **Branch** → `main`, folder → `/ (root)`.
4. **Save**. Wait ~30 seconds for the first build.
5. Your README.md is now served at `https://<yourname>.github.io/GhostViewer/`. The privacy policy is at `https://<yourname>.github.io/GhostViewer/PRIVACY_POLICY` (Pages auto-strips the `.md`).

The blob URL works just as well for Chrome's purposes; only do GitHub Pages if you want a project landing page too.

---

## 4. Final repo touches before submission

After your first push, two small edits worth doing in the repo's web UI:

1. **Repo description** at the top — open the repo page, click the gear icon next to "About", paste:
   > Watch Twitch and Kick streams without being counted as a viewer or seeing ads. MV3 browser extension for Chrome and Firefox.
   - Add the website field if you set up GitHub Pages.
   - Add topics (tags): `chrome-extension`, `firefox-extension`, `twitch`, `kick`, `streaming`, `manifest-v3`.

2. **Pick a license** — the README has `[Specify your license here]`. Common picks for browser extensions:
   - **MIT** — most permissive, anyone can use/modify/redistribute. Recommended.
   - **GPL-3.0** — copyleft; derivative works must also be open-source.
   - **Custom / All rights reserved** — only if you don't want anyone forking it.

   Easiest way: GitHub web UI → **Add file** → **Create new file** → name it exactly `LICENSE`, click "Choose a license template" link in the top-right, pick MIT, fill in name and year, commit.

   Then update the README's License section with the actual license name.

---

## 5. Update the Chrome Web Store dashboard

Once the repo is live and you have the privacy policy URL:

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **New item**, upload `c:\Users\Oskar\Downloads\GhostViewer-1.30.zip`.
3. **Privacy practices** tab → paste your privacy policy URL.
4. **Store listing** tab → copy the long description from [STORE_LISTING.md](STORE_LISTING.md) (replace `<PASTE PRIVACY POLICY URL HERE>` and `<PASTE GITHUB URL>` placeholders with your actual URLs).
5. **Distribution** → upload screenshots when ready.
6. **Submit for review.**

---

## What gets pushed vs. what stays local

The `.gitignore` ensures these stay **out** of the repo (they're not for users):

- `.claude/` — your local Claude Code workspace
- `claude.md` — project instructions (private)
- `design-backup-*/` — UI snapshots from earlier iterations
- `_metadata/` — Chrome auto-generates this on installed extensions
- `*.zip` — release builds go to `~/Downloads`, not the repo
- `*.local.md`, `NOTES.md` — your scratch notes

These **do** get pushed (they're documentation for users + reviewers):

- `README.md` — repo landing page
- `PRIVACY_POLICY.md` — the URL you'll give Chrome
- `STORE_LISTING.md` — the long description for the store form
- `DESIGN_PROPOSAL.md` — design rationale (optional; can `.gitignore` if you'd rather keep it private)
- `Commands.md` — if you create one for frequent commands

If you'd rather keep `STORE_LISTING.md` and `DESIGN_PROPOSAL.md` private, add them to `.gitignore` before your first commit.

---

## Future workflow

For each new release:

```bash
# In: c:\VSCodeProjects\GhostViewer

git add -A
git commit -m "v1.31: short description of what changed"
git push
```

Optionally tag releases for clean version history:

```bash
git tag v1.31
git push --tags
```

GitHub then shows them under the **Releases** tab and you can attach the zip there for users who want to install from source.

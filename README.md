# 📦 SillyTavern Smart Import (v1.0.0)

A robust, batch-processing frontend extension for SillyTavern that intelligently prevents duplicate character creation during external imports. Built to intercept the native import process, scan your local database using bidirectional metadata matching, and force a seamless *update* to existing characters instead of spawning clones.

### ✨ Features
* **🚀 Batch Processing:** Paste multiple URLs/IDs/UUIDs (separated by newlines) into the import box to queue them up. The script automatically processes them one by one.
* **🧠 Intelligent Overwrites:** Identifies characters across different metadata structures and updates their local files.
* **🥷 Auto-Lorebook Handling:** Automatically assassinates the intrusive "Overwrite Lorebook?" popup during batch imports, ensuring your queue never stalls.
* **🛡️ Unsupported Link Firewall:** Actively intercepts broken host APIs (JanitorAI, Risu) that natively fail SillyTavern's backend scraper, skipping them gracefully to protect the batch queue.
* **🔒 Strict Security for Direct PNGs:** Because raw image URLs cannot be duplicate-checked prior to download, the script intentionally blocks them and prompts the user to consciously bypass the extension if they wish to mass-import image characters.
* **🔄 Auto-Updating:** Fully integrated with SillyTavern's native package manager to automatically fetch future patches and upgrades directly from GitHub.

---

### ⚙️ Installation (One-Time Setup)

Because this is a native third-party extension, installation is done directly through your SillyTavern.

1. Open your SillyTavern Extensions tab.
2. Press **Install extension** at the top.
3. Paste the following GitHub URL into the top box:
   ```URL
   https://github.com/GentleBurr/SillyTavern-SmartImport
   ```
4. Press install.
5. Make sure it's activated. You're done!

---

### 🚀 How to Use 

1. Open SillyTavern and switch to the Character Management tab.
2. Click on the **External Import** button (the blue cloud with a downward arrow).
3. You will notice the "Import" button has now automatically turned into **Smart Import**.
4. Paste your massive list of links (one per line) into the box.
5. Click **Smart Import** and let the script handle the heavy lifting! It will notify you via Toastr popups whether a character is being imported, updated, or skipped.

---

### 📦 Supported Platforms
The duplicate-checking engine currently supports bidirectional matching for:
* **Chub.ai** (Characters & Lorebooks)
* **Pygmalion.chat**
* **AICharacterCards**
* **Perchance** (`.gz` exports)

*(Note: JanitorAI, RisuAI, and Direct PNG links are currently skipped by the firewall due to host API limitations or a lack of pre-fetch metadata.)*

---

### 📝 Notes & Disclaimer
* **Backend API Reliance:** This script relies on SillyTavern's internal `importFromExternalUrl` utility function. It requires a minimum client version of **1.16.0**.
* **Ghost Metadata:** If a character's internal JSON `extensions` data was destroyed by native import scrapers *prior* to installing this extension, the script may fail to detect the clone on the very first run.
* **Disclaimer:** This is a client-side quality-of-life tool. It does not modify SillyTavern's core server files, but it does heavily manipulate the DOM and native UI events. Please use responsibly and respect the servers of the sites you are scraping!

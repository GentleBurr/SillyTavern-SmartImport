# Security Policy

## Supported Versions

Because this is a lightweight frontend extension dependent on SillyTavern's native API, only the latest major release branch is actively supported with security patches. 

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.x | :x:                |

*Note: Security and functionality are only guaranteed when running on SillyTavern client versions **1.16.0 or higher**.*

## Reporting a Vulnerability

Since this is a client-side tool operating entirely within your local SillyTavern environment, the primary security risks involve malicious external URLs or bad metadata attempting to break the UI (e.g., XSS attacks).

If you discover a vulnerability that could compromise a user's local SillyTavern instance or browser context:
* **Please do NOT open a public GitHub Issue.**
* Instead, directly message me on Reddit at [u/SirGentlenerd](https://www.reddit.com/u/SirGentlenerd/).

I will acknowledge your report within 48 hours, evaluate the threat, and work on deploying a patch. Once the vulnerability is resolved, the fix will be pushed immediately via SillyTavern's native auto-updater to protect all users.

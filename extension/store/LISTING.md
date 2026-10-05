# Chrome Web Store listing

Copy these fields into https://chrome.google.com/webstore/devconsole after the zip uploads.

Upload zip: `extension/.output/visa-slot-notifier-0.2.1-chrome.zip`  
Store icon (128×128): `extension/assets/icon-128.png`  
Screenshots: `extension/store/screenshots/`

Privacy policy URL: `https://freevisaslotnotifier.com/privacy`  
Homepage URL: `https://freevisaslotnotifier.com`  
Support URL: `https://freevisaslotnotifier.com`

Category: Productivity  
Language: English  
Visibility: Public

---

## Product name

Visa Slot Notifier

## Short description (132 characters max)

Free Telegram alerts when someone shares an open U.S. visa date in India. Never asks for your login. Never books for you.

## Detailed description

Visa Slot Notifier is a free Chrome extension for people booking U.S. visa appointments in India (Mumbai, New Delhi, Chennai, Hyderabad, Kolkata).

When someone checking the official scheduling site sees open OFC or consular dates, they open this extension, pick the post and visa class, tap the open days on a small calendar, and press Share. They can also highlight a date on any page and right-click “Share this date”. Everyone whose filters match gets one Telegram message right away. Many people can share the same date; you still get only one alert.

What it does
• Connects this browser to Telegram so you can choose posts, visa class, OFC or consular, and an optional date range
• Lets you share dates you saw yourself: tap them on a calendar, or right-click a highlighted date
• Lets you pause alerts at any time

What it never does
• Never runs on, reads, or touches the official scheduling site
• Never asks for your visa-site username, password, or security answers
• Never clicks, types, fills forms, or books an appointment
• Never charges for alerts. There is no paid tier.

Alerts are sent by Telegram bot @VisaSlotNotifierForAllFreeBot. You book the date yourself on the official site. A slot can disappear before you arrive.

How to use
1. Install this extension
2. Open it, tap Connect Telegram, and press Start in the bot
3. Pick the posts and visa class you care about
4. When you see open dates on the official site, tap them in the popup and press Share

Website: https://freevisaslotnotifier.com
Privacy: https://freevisaslotnotifier.com/privacy

Not affiliated with any U.S. government agency, embassy, consulate, or visa scheduling provider.

---

## Single purpose (Privacy practices tab)

Free Telegram alerts for U.S. visa appointment dates in India. The extension (1) links Telegram so the user can set alert filters, and (2) lets the user share appointment dates they saw, by tapping them in the popup or right-clicking a date they highlighted. It does not run on any other website, book appointments, fill forms, or collect visa-site logins.

---

## Permission justifications

### storage

Stores on this device only: a secret used to link Telegram, the post, appointment type, and visa class the user last shared so they do not have to pick them again, and, for a few minutes, a date picked from a right-click until the popup shows it. No passwords or visa-site credentials are stored.

### contextMenus

Adds one right-click item, “Share this date with Visa Slot Notifier”, shown only when the user has highlighted text. When the user clicks it, the extension looks for a date in that highlighted text and opens the popup with the date pre-selected; the user reviews it and presses Share. Nothing is sent until they do. The extension has no content scripts and does not read pages.

No host permissions. The popup calls our own API at https://freevisaslotnotifier.com, which allows extension origins with CORS headers.

---

## Remote code

Select: **No, I am not using remote code.**

The extension only loads its own packaged scripts. It talks to https://freevisaslotnotifier.com over HTTPS for JSON shares and settings. It does not download or execute script from the network.

---

## Data usage checkboxes

Check these collection types (and only these):

- **Personally identifiable information** — Telegram chat id, only after the user presses Start in the bot. Used solely to deliver matching alerts and remember filters.
- **User activity** — the filters they saved, and a short-lived count of their shares, used only for rate limits.

Do **not** check: website content, health, financial, authentication information, personal communications, location, web history.

Certify all Limited Use statements (you do not sell data, you use it only for this extension’s features, you do not use it for creditworthiness, and so on).

---

## Screenshots to upload

1. `screenshot-connect-1280x800.png` — popup, Connect Telegram
2. `screenshot-settings-1280x800.png` — popup, filters after connecting
3. `screenshot-share-1280x800.png` — popup, tapping dates on the share calendar
4. `promo-440x280.png` — optional small tile

Remove the old settings screenshot from the dashboard and upload the new one; the old one shows the removed “Share dates I see” toggle.

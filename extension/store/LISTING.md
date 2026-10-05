# Chrome Web Store listing

Copy these fields into https://chrome.google.com/webstore/devconsole after the zip uploads.

Upload zip: `extension/.output/visa-slot-notifier-0.1.0-chrome.zip`  
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

Free Telegram alerts when someone sees a U.S. visa date in India. Never asks for your login. Never books for you.

## Detailed description

Visa Slot Notifier is a free Chrome extension for people booking U.S. visa appointments in India (Mumbai, New Delhi, Chennai, Hyderabad, Kolkata).

When you are already on the official scheduling site (usvisascheduling.com), the extension can share the open OFC or consular dates that page is already showing. Matching people get one Telegram message. Many people can see the same date; you still get only one alert.

What it does
• Connects this browser to Telegram so you can choose posts, visa class, OFC or consular, and an optional date range
• Reads appointment dates already visible on the official calendar and sends only post, visa class, appointment type, and dates
• Lets you pause sharing or alerts at any time

What it never does
• Never asks for your visa-site username, password, or security answers
• Never clicks, types, fills forms, or books an appointment
• Never sends your name, passport number, or a screenshot
• Never charges for alerts. There is no paid tier.

Alerts are sent by Telegram bot @VisaSlotNotifierForAllFreeBot. You book the date yourself on the official site. A slot can disappear before you arrive.

How to use
1. Install this extension
2. Open it, tap Connect Telegram, and press Start in the bot
3. Pick the posts and visa class you care about
4. If you check the official calendar, turn on “Share dates I see” and choose your visa class

Website: https://freevisaslotnotifier.com
Privacy: https://freevisaslotnotifier.com/privacy

Not affiliated with any U.S. government agency, embassy, consulate, or visa scheduling provider.

---

## Single purpose (Privacy practices tab)

Free Telegram alerts when a U.S. visa appointment date in India is seen on the official scheduling site. The extension (1) links Telegram so the user can set filters, and (2) reports dates already shown on usvisascheduling.com. It does not book appointments, fill forms, or collect visa-site logins.

---

## Permission justifications

Paste into each justification box. If Google also lists the content-script host, use the usvisascheduling.com answer.

### storage

Stores on this device only: a random install id used to rate-limit reports, a secret used to link Telegram, the user’s alert filters, and whether they opted to share calendar dates. No passwords or visa-site credentials are stored.

### Host permission: https://freevisaslotnotifier.com/*

Sends slot reports and reads/saves Telegram subscription filters on our HTTPS API. The extension does not access any other website through this permission.

### Host / content script: https://www.usvisascheduling.com/*

Runs only on the official U.S. visa scheduling site for India. It reads appointment dates the page already loaded to draw its calendar (post, OFC or consular, and dates). It never clicks, types, submits forms, or books. It does not read login fields or the rest of the page.

---

## Remote code

Select: **No, I am not using remote code.**

The extension only loads its own packaged scripts. It talks to https://freevisaslotnotifier.com over HTTPS for JSON reports and settings. It does not download or execute script from the network.

---

## Data usage checkboxes

Check these collection types (and only these):

- **Personally identifiable information** — Telegram chat id, only after the user presses Start in the bot. Used solely to deliver matching alerts and remember filters.
- **User activity** — which filters they saved, and that this install reported a slot (a random install id, for rate limits).
- **Website content** — structured calendar data from usvisascheduling.com: post, visa class the user selected in the popup, OFC or consular, and up to 10 dates. Not the full page, not screenshots, not form fields.

Do **not** check: health, financial, authentication information, personal communications, location, web history.

Certify all Limited Use statements (you do not sell data, you use it only for this extension’s features, you do not use it for creditworthiness, and so on).

---

## Screenshots to upload

1. `screenshot-connect-1280x800.png` — popup, Connect Telegram
2. `screenshot-settings-1280x800.png` — popup, filters after connecting
3. `promo-440x280.png` — optional small tile

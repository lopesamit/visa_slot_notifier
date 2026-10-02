# Visa Slot Notifier

A free, community-powered U.S. visa appointment tracker. People who are already
on the official scheduling site report openings they can see, and anyone whose
filters match gets a direct Telegram message.

Not affiliated with any U.S. government agency, embassy, consulate, or visa
scheduling provider. Alerts are informational: people book on the official site
themselves.

## Product rules

These hold for every part of the project.

1. **Free.** Every alert goes to every matching subscriber immediately. There is
   no paid tier and no delayed public tier.
2. **Donations unlock nothing.** The donate button is a thank-you link only.
3. **No booking, no automation.** The extension never clicks, types, fills
   forms, or books on the scheduling site. It only reads dates already on screen.
4. **No credentials.** We never ask for, store, or transmit visa-site logins,
   passwords, payment details, or applicant personal data.
5. **No screenshots.** The extension sends structured slot data only.
6. **One alert per opening.** Reports of the same post, visa class, appointment
   kind, and date are one slot. A subscriber gets at most one message for a slot
   within a 12-hour wave, however many people report it.
7. **Secrets stay on the server.** The MongoDB connection string and Telegram
   bot token live in Netlify environment variables, never in the extension or
   in browser code.

## Coverage (v1)

- Posts: Chennai, Hyderabad, Kolkata, Mumbai, New Delhi
- Visa classes: H-1B, H-4, B-1/B-2, F-1/F-2, L-1/L-2
- Appointment kinds: OFC, Consular
- Alerts: Telegram

The canonical lists and the slot key live in `shared/`.

## Layout

| Path | Purpose |
| --- | --- |
| `shared/` | Catalog, slot key, and validation shared by the extension and API |
| `extension/` | Chrome extension (WXT, Manifest V3): settings popup and slot reporter |
| `web/` | Public website (Astro) deployed to Netlify |
| `netlify/functions/` | API: report ingest, Telegram webhook, public board |
| `scripts/` | One-off tasks such as creating MongoDB indexes |

`extension/`, `web/`, `netlify/functions/`, and `scripts/` are added in later
build steps.

## Stack

| Part | Choice |
| --- | --- |
| Hosting and API | Netlify (static site + Functions) |
| Database | MongoDB Atlas |
| Notifications | Telegram Bot API |
| Donations | External link (Ko-fi or similar) |

## Local setup

Requires Node 20 (see `.nvmrc`).

```sh
nvm use
npm install
npm test
```
# visa_slot_notifier

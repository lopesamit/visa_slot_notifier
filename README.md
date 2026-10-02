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
| `api/src/` | MongoDB access: slot waves, subscribers, deliveries |
| `api/scripts/` | `db:check` and `db:indexes` against the database in `.env` |
| `api/functions/` | Netlify Functions: report ingest, Telegram webhook, public board |

## Stack

| Part | Choice |
| --- | --- |
| Hosting and API | Netlify (static site + Functions) |
| Database | MongoDB Atlas |
| Notifications | Telegram Bot API |
| Donations | [Ko-fi](https://ko-fi.com/visasolthelper). A gift only; it unlocks nothing. Hidden for now; turn on with `DONATIONS_ENABLED` in `shared/src/site.ts`. |

## Local setup

Requires Node 22 (see `.nvmrc`).

```sh
nvm use
npm install
npm test
```

`npm test` starts a throwaway local MongoDB for the API tests; it does not touch
Atlas.

To use Atlas, copy `.env.example` to `.env`, set `MONGODB_URI`, then:

```sh
npm run db:check -w api
npm run db:indexes -w api
```

## Telegram bot

Run the bot on your machine (long polling, no webhook needed):

```sh
npm run bot:poll -w api
```

If the production webhook is set, polling refuses to start. Pass
`-- --take-over` to remove it, and run `npm run bot:webhook -w api` afterwards
to point Telegram back at `https://freevisaslotnotifier.com/api/telegram`.

## Extension

The popup creates two random IDs on first run: an `installId` for reports and
a secret `linkKey` that connects Telegram through
`t.me/VisaSlotNotifierForAllFreeBot?start=<linkKey>`. The server stores only a
hash of the `linkKey`. Filters are read and saved with `POST /api/subscription`.

Try it locally against the local API:

```sh
npm run serve -w api                    # API on http://localhost:8787
npm run bot:poll -w api -- --take-over  # bot replies from your machine
npm run build:local -w extension
```

Load `extension/.output/chrome-mv3-dev` in `chrome://extensions` (Developer
mode, Load unpacked). `npm run build -w extension` builds the store version,
which talks to `https://freevisaslotnotifier.com`.

### Slot reporter

On `https://www.usvisascheduling.com`, the extension reads the calendar data
the site already loads for its OFC and consular calendars (routes ending in
`schedule-days`). It never clicks, types, or sends its own requests to the site.
It sends only post, visa class (chosen in the popup, since the page does not
show it), OFC or consular, and up to 10 dates. The same calendar is not sent
again for 10 minutes.

To try it without an account, the local API serves a mock scheduler:
`http://localhost:8787/dev/ofc-schedule` (loads days with fetch) and
`http://localhost:8787/dev/schedule` (with XHR). Its dates are in August 2028.
Delete them afterwards with:

```sh
npm run dev:cleanup -w api
```

## Report endpoint

The extension sends `POST /api/report`:

```json
{
  "installId": "random-id-from-the-extension",
  "post": "mumbai",
  "visaClass": "h1b",
  "kind": "ofc",
  "dates": ["2027-01-05", "2027-01-12"]
}
```

Up to 10 dates per report, from yesterday to two years ahead. Each browser may
send 20 reports per 10 minutes and each IP 60. Only the report that opens a new
12-hour wave for a slot sends alerts; everyone else's report just adds to the
count.

To check the whole path against Atlas and Telegram, sending test-labeled alerts
only to the few chats that match:

```sh
npm run report:simulate -w api -- mumbai h1b ofc 2027-06-15 25
```

It refuses to run if more than three chats match, and deletes what it created.

## Deploy

```sh
npm run deploy
```

Netlify needs `MONGODB_URI`, `MONGODB_DB`, `TELEGRAM_BOT_TOKEN`, and
`TELEGRAM_WEBHOOK_SECRET` set as environment variables.

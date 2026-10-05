# Visa Slot Notifier

A free, community-powered U.S. visa appointment tracker. People who see an
opening on the official scheduling site share it from the extension, and anyone
whose filters match gets a direct Telegram message.

Not affiliated with any U.S. government agency, embassy, consulate, or visa
scheduling provider. Alerts are informational: people book on the official site
themselves.

## Product rules

These hold for every part of the project.

1. **Free.** Every alert goes to every matching subscriber immediately. There is
   no paid tier and no delayed public tier.
2. **Donations unlock nothing.** The donate button is a thank-you link only.
3. **No automation on the scheduling site.** The site's terms forbid access
   through bots, crawlers, or scripts. The extension never runs on, reads,
   clicks, or books on it. People share dates they saw by hand.
4. **No credentials.** We never ask for, store, or transmit visa-site logins,
   passwords, payment details, or applicant personal data.
5. **No screenshots.** A share is structured slot data only.
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
| `extension/` | Chrome extension (WXT, Manifest V3): settings popup, share calendar, and right-click share |
| `web/` | Public website (Astro) deployed to Netlify |
| `api/src/` | MongoDB access: slot waves, subscribers, deliveries |
| `api/scripts/` | `db:check` and `db:indexes` against the database in `.env` |
| `api/functions/` | Netlify Functions: date sharing, subscription settings, Telegram webhook |

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

The popup creates a random secret `linkKey` on first run. It connects Telegram
through
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

`npm run build:site` also copies that zip to a private page at
`/testing`. Nothing on the public site links to it. Share
`https://freevisaslotnotifier.com/testing` with testers.

### Sharing a date

The extension never runs on `usvisascheduling.com`. It has no content scripts
and no permission for that site. A person who sees an open date there opens
the popup, picks the post, OFC or consular, and visa class, taps the open days
on a month calendar, and presses **Share**. The popup remembers the last post,
type, and visa class.

A right-click item, "Share this date with Visa Slot Notifier", appears for
highlighted text. Chrome passes only that text to the background script, which
finds full dates in it (`src/dates.ts`) and opens the popup with them
pre-selected. Nothing is sent until the user presses Share.

To try it locally, share dates in August 2028 so they never look like real
openings, then delete them with:

```sh
npm run dev:cleanup -w api
```

## Share endpoint

The popup sends `POST /api/share`:

```json
{
  "linkKey": "the-browser's-link-secret",
  "post": "mumbai",
  "visaClass": "h1b",
  "kind": "ofc",
  "dates": ["2027-01-05"]
}
```

Only a browser linked to a Telegram chat can share (403 otherwise). Up to 10
dates per share, from yesterday to two years ahead. Each chat may share 10
times an hour and each IP 30. A share that opens a new 12-hour wave for a slot
alerts every matching subscriber right away, except the person who shared;
later shares in the same wave send nothing.

## Private dashboard

`/admin` is not linked anywhere and is marked noindex. It asks for the
`ADMIN_TOKEN` from `.env` (also set in Netlify) and calls `POST /api/admin`
with it as a bearer token. It shows the last 90 days of shares (with the
sharer's Telegram name looked up live), openings, and subscriber filters, with
filters, charts, and CSV export. Every share is logged in the `shares`
collection, which expires entries after 90 days.


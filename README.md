@qadeer-xtech/stablebail

<p align="center">
  **STABLEBAIL — POWERED BY TEAM QADEER**
</p>

A powerful WhatsApp Web API library built on the Baileys architecture, enhanced with custom fixes, improved media handling, advanced newsletter support, and additional WhatsApp features.

Based on **@whiskeysockets/baileys 7.0.0-rc14** (MIT). Source, issues and changelog: https://github.com/Qadeer-Xtech/stablebail

[![CI](https://github.com/Qadeer-Xtech/stablebail/actions/workflows/ci.yml/badge.svg)](https://github.com/Qadeer-Xtech/stablebail/actions/workflows/ci.yml)

## Browser identity setup (in your `index.js`)

The `browser` option in `makeWASocket` decides how your bot appears to
WhatsApp. It changes what WhatsApp sends your bot, so pick carefully —
nothing else in your bot code changes, and your existing session keeps
working; the identity simply applies on the next connect.

**1. Ubuntu / web identity** — the bot looks like a browser on Ubuntu.

```js
browser: Browsers.ubuntu('Chrome')
```

- **Who it is for:** simple bots — commands, groups, chats — that do
  not need phone-class media.
- **How it behaves:** pairing works the normal way and channel
  (newsletter) data arrives as plain JSON. But WhatsApp treats
  browsers as web companions: **view-once photos/videos can arrive as
  empty stubs** with no media inside. If your bot needs view-once,
  use setup 2 or 3.

**2. Android phone identity** — the bot presents itself as an Android
phone.

```js
browser: Browsers.androidPhone('Chrome')
```

- **Who it is for:** bots that need full media, above all view-once.
- **What changes in the bot after this setup:** WhatsApp treats the
  bot as a phone-class device, so **view-once media actually arrives**
  instead of empty stubs. One side effect: on Android sessions,
  channel data can arrive in a compact **binary format** instead of
  JSON — StableBail decodes that format fully, so your channel
  features (name, followers, description, picture) keep working.

**3. Dynamic identity (recommended)** — pair easily, run as Android.

```js
const getBrowserIdentity = (registered) =>
	registered ? Browsers.androidPhone('Chrome') : Browsers.macOS('Safari')

// inside makeWASocket:
browser: getBrowserIdentity(state.creds.registered)
```

- **Who it is for:** most bots — this is the setup we recommend.
- **How it works:** while the session is fresh (not yet registered),
  the Safari/Mac identity pairs the fastest and most reliably. As
  soon as the session is registered, the identity switches to the
  Android phone identity by itself on the next connect — **no
  re-pairing, no code change** — and the bot gets the full Android
  behaviour from setup 2, including view-once media.

**In short:** Ubuntu = simple web bot, no view-once. Android =
phone-class bot, view-once works. Dynamic = easy pairing first,
Android powers after — the best of both.

## View-once — the fix, and the bot code for it

**The problem:** on browser/web identities, WhatsApp delivers
view-once photos and videos to companion devices as *empty stubs* —
the message arrives, but there is no media inside it. No bot code can
recover media that never arrived.

**The fix in StableBail:** when the bot runs on the Android phone
identity, StableBail presents a real Android device in the connection
user-agent (device = `Android`, not `Desktop`). WhatsApp then treats
the bot as a phone-class device and delivers view-once media
normally — it works out of the box, nothing to configure in the
library.

**The code you add in your bot (`index.js`):** just run the bot on
the Android identity — or use the dynamic setup so pairing stays
easy and Android takes over right after:

```js
const {
	default: makeWASocket,
	Browsers,
	useMultiFileAuthState
} = require('@whiskeysockets/baileys')

const getBrowserIdentity = (registered) =>
	registered ? Browsers.androidPhone('Chrome') : Browsers.macOS('Safari')

const { state, saveCreds } = await useMultiFileAuthState('auth')

const sock = makeWASocket({
	auth: state,
	browser: getBrowserIdentity(state.creds.registered)
})
```

That is all. Pair once (Safari identity), and from the next connect
onward the bot runs as Android and view-once media arrives — your
view-once commands can then download the quoted message as usual.

## Why StableBail instead of stock Baileys?

Same API — StableBail is Baileys 7.0.0-rc14 plus reviewed fixes that
upstream has not released yet:

| Area | Stock rc14 | StableBail |
|---|---|---|
| Media reupload on 403/404/410 | broken | fixed (1.0.3) |
| Stream drops ~50 min (status ack) | broken | fixed (1.0.7) |
| Pairing code 515 failures | broken | fixed (1.0.7) |
| creds.json corruption on crash | possible | atomic writes (1.0.7) |
| Channel (newsletter) media | often invisible | fixed paths (1.0.2 + 1.0.7) |
| Status mentions | not available | `sendStatusMention` (1.0.5) |
| Retry double-encryption | present | fixed (1.0.7) |
| View-once on Android companions | unavailable stubs | works out of the box (1.0.12) |
| Ban / number status checker | not available | `checkStatusWA` (1.0.12) |

Full per-version list: [CHANGELOG.md](CHANGELOG.md) · Plans: [ROADMAP.md](ROADMAP.md) · Runnable samples: [examples/](examples/)

## Switching from official Baileys (1 minute)

Change only the dependency line — your code stays the same:

```json
"@whiskeysockets/baileys": "npm:@qadeer-xtech/stablebail@latest"
```

Designed for developers who need a familiar Baileys-compatible API with extra functionality and a smoother development experience.

## TypeScript source

The full TypeScript source of this package is in
[`src/`](src/). It is **build-verified**: compiling it with the
included tsconfig reproduces the shipped `lib/` JavaScript
exactly — what you read here is what runs. (The published
tarball omits the build's sourcemap files, and a few type
declarations were completed so the types match the shipped JS.)

## 📦 Installation

```bash
npm install @qadeer-xtech/stablebail
```

## Use as Official Baileys Replacement

To use StableBail without changing your existing import paths, add this alias to your "package.json":

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "npm:@qadeer-xtech/stablebail@latest"
  }
}
```

This allows existing Baileys-based projects to use StableBail while keeping their original package imports.

## ✅ Recommended Settings for Bot Projects

For a smooth, error-free install, use these exact settings in your bot's "package.json":

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "npm:@qadeer-xtech/stablebail@1.0.13",
    "sharp": "0.35.5",
    "wa-sticker-formatter": "4.4.4"
  },
  "overrides": {
    "sharp": "$sharp"
  },
  "engines": {
    "node": "20.x"
  }
}
```

## ✨ Key Features

- Baileys-Compatible API — Familiar socket methods and existing Baileys workflow.
- Newsletter Enhancements — Improved channel messaging, media uploads, subscriptions, and metadata fetching.
- Media Stream Fixes — Improved download error handling, media retries, and expired-link recovery.
- Windows Hybrid Support — Updated device identification for modern WhatsApp connections.
- LID Compatibility — Improved "onWhatsApp()" support for LID-based addresses.
- Status Mentions — Mention contacts and groups in WhatsApp status updates.
- CSToken / NCT Support — Additional token handling for LID-addressed messaging.
- Connection Banner — Optional branded startup banner.
- Improved Stability — Additional fixes for connection handling and media operations.

## 🔧 What's Included

### 1. Newsletter / Channel Support

Extended newsletter functionality with improved message fetching, media handling, and channel metadata support.

Available methods:

| Method | Description |
| --- | --- |
| "newsletterFromUrl()" | Fetch channel information from an invite link |
| "newsletterSubscribed()" | Get subscribed channels |
| "newsletterFetchAllSubscribe()" | Fetch all subscribed channels |
| "newsletterFetchMessages()" | Retrieve channel messages |
| "newsletterFetchUpdates()" | Fetch views and reactions |
| "newsletterReactionMode()" | Change channel reaction settings |
| "newsletterFollow()" | Follow a channel |
| "newsletterUnfollow()" | Unfollow a channel |
| "newsletterReactMessage()" | React to channel messages |

Additional improvements:

- Dedicated newsletter media upload handling.
- Improved channel message decoding.
- Better thumbnail handling.
- Protection against missing channel profile pictures.
- Support for legacy message-fetching arguments.

### 2. Media Streaming Improvements

Enhanced media download and retry handling.

- Proper stream error propagation.
- Prevents downloads from remaining stuck after stream failures.
- Improved recovery for expired media links.
- Handles CDN "403", "404", and "410" responses.
- Improved phone-based media reupload handling.
- Automatically converts Base64 media keys into usable byte data when required.

### 3. Connection & Device Compatibility

- Updated Windows device identification using "WIN_HYBRID".
- Updated default WhatsApp Web version configuration.
- Improved LID address handling in "onWhatsApp()".
- Returns LID information alongside standard WhatsApp lookup results when available.

Example response:

```js
{
  jid,
  exists,
  lid
}
```

### 4. Status Mentions

StableBail includes "sendStatusMention()" for mentioning contacts or groups in WhatsApp status updates.

Mention individual contacts:

```js
await sock.sendStatusMention(
    [
        '923001234567@s.whatsapp.net',
        '923009876543@s.whatsapp.net'
    ],
    {
        text: 'Eid Mubarak! 🌙'
    }
)
```

Mention a group:

```js
await sock.sendStatusMention(
    ['120363000000000000@g.us'],
    {
        image: {
            url: 'https://example.com/pic.jpg'
        },
        caption: 'Team Qadeer'
    },
    {
        delayMs: 1500
    }
)
```

"delayMs" controls the delay between mention operations. Its default value is "1500" milliseconds.

### 5. CSToken / NCT Support

Additional support for WhatsApp's NCT and contact token handling.

- Collects NCT salt through history and app-state synchronization.
- Stores available NCT salt in authentication credentials.
- Supports regular-high synchronization when history synchronization is disabled.
- Computes CSToken using HMAC-SHA256 when a required token is unavailable.
- Prioritizes existing TCToken data when available.
- Adds additional token handling for LID-addressed messaging.

The library also exposes existing reach-out timelock information through:

```js
sock.fetchAccountReachoutTimelock()
```

And the connection update event can provide "reachoutTimeLock" information.

### 6. Custom Connection Banner

StableBail includes an optional branded connection banner.

```
╭───────────────────────────╮
│      ✦ Q A D E E R ✦      │
│ stablebail • Qadeer-Xtech │
╰───────────────────────────╯
```

The banner is displayed once when the connection opens.

To disable it:

```js
const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    banner: false
})
```

## 🚀 Basic Usage

```js
const makeWASocket =
    require('@qadeer-xtech/stablebail').default

const {
    useMultiFileAuthState,
    DisconnectReason
} = require('@qadeer-xtech/stablebail')

async function startBot() {
    const { state, saveCreds } =
        await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on('creds.update', saveCreds)

    return sock
}

startBot()
```

## 📡 Newsletter Examples

Fetch Channel Information

```js
const channel = await sock.newsletterFromUrl(
    'https://whatsapp.com/channel/CHANNEL_ID'
)

console.log(
    channel.id,
    channel.name,
    channel.subscribers
)
```

Follow / Unfollow

```js
await sock.newsletterFollow(channel.id)

await sock.newsletterUnfollow(channel.id)
```

Get Subscribed Channels

```js
const channels = await sock.newsletterSubscribed()

console.log(channels)
```

Fetch Channel Messages

```js
const messages = await sock.newsletterFetchMessages(
    channel.id,
    20
)

console.log(messages)
```

Fetch Views & Reactions

```js
const updates = await sock.newsletterFetchUpdates(
    channel.id,
    20
)

console.log(
    updates[0].server_id,
    updates[0].views,
    updates[0].reactions
)
```

Send Channel Message

```js
await sock.sendMessage(channel.id, {
    text: 'Assalam o Alaikum! 👋'
})
```

Send Channel Image

```js
await sock.sendMessage(channel.id, {
    image: {
        url: 'https://example.com/pic.jpg'
    },
    caption: 'New Channel Update'
})
```

React to Channel Message

```js
await sock.newsletterReactMessage(
    channel.id,
    updates[0].server_id,
    '❤️'
)
```

## ⚙️ Compatibility

- Node.js environment
- Baileys-compatible socket workflow
- Existing Baileys-based bot projects
- Multi-file authentication
- WhatsApp Web connection workflows

StableBail is designed to minimize migration work for existing Baileys users. However, custom methods and options are specific to this package.

## ⚠️ Important Notes

- Some custom features may require live WhatsApp testing.
- Status mention functionality should be tested with a dedicated account before production use.
- WhatsApp may change its internal protocols without notice.
- Connection restrictions, account-level limitations, and server-side errors cannot always be resolved through library-side changes.
- Always keep your authentication credentials private.

## 📄 License

MIT License — see the [LICENSE](LICENSE) file. The whole package
is under MIT: the upstream Baileys code (© Rajeh Taher /
WhiskeySockets) and Team Qadeer's fixes, extensions and branding
(© Team Qadeer / Qadeer-Xtech) alike. The [NOTICE](NOTICE) file
ships with the package and carries a (non-binding) credit request.

## Dependencies

The two core dependencies are faithful republishes under the same
scope, with code **byte-identical** to upstream (proof in each
repo's DIFF.md):

- [@qadeer-xtech/libsignal](https://github.com/Qadeer-Xtech/libsignal) — of official libsignal 6.0.0
- [@qadeer-xtech/whatsapp-rust-bridge](https://github.com/Qadeer-Xtech/whatsapp-rust-bridge) — of official whatsapp-rust-bridge 0.5.4

## 🖤 Credits

Developed and maintained by Team Qadeer.

STABLEBAIL — Built for developers. Enhanced for performance.

"Powered by Team Qadeer"

@qadeer-xtech/stablebail

<p align="center">
  **STABLEBAIL — POWERED BY TEAM QADEER**
</p>

A powerful WhatsApp Web API library built on the Baileys architecture, enhanced with custom fixes, improved media handling, advanced newsletter support, and additional WhatsApp features.

Designed for developers who need a familiar Baileys-compatible API with extra functionality and a smoother development experience.

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

MIT License

## 🖤 Credits

Developed and maintained by Team Qadeer.

STABLEBAIL — Built for developers. Enhanced for performance.

"Powered by Team Qadeer"

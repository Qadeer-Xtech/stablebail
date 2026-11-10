# @qadeer-xtech/stablebail

WhatsApp Web API library — Team Qadeer ki apni copy, official Baileys 7.0.0-rc14 par mabni, channels (newsletter) ke fixes ke sath.

## Install

```
npm install @qadeer-xtech/stablebail
```

Bot ke `package.json` mein official naam ke tor par:

```json
"@whiskeysockets/baileys": "npm:@qadeer-xtech/stablebail@latest"
```

## 1.0.2 mein kya fix hai (Channels / Newsletter)

Official rc14 mein channel ke ye hisse adhoore ya toote hue thay — 1.0.2 mein theek hain:

- **Channel messages parhna** — `newsletterFetchMessages` ab WA Web wale asal tareeqe se kaam karta hai aur messages ko decode karke saaf list deta hai (pehle khaali khaam jawab aata tha)
- **Channel par media bhejna** — newsletter ke liye alag media upload rasta (`NEWSLETTER_MEDIA_PATH_MAP` + server thumbnail) lagaya hai; pehle channel par media ghalat raste se ja kar atak jata tha
- **Subscribed channels ki list** — naya `newsletterSubscribed()` (aur `newsletterFetchAllSubscribe()`), bilkul `groupFetchAllParticipating` ki tarah
- **Link se channel maloom karna** — naya `newsletterFromUrl(url)`: channel ke invite link se seedha metadata
- **Views aur reactions** — naya `newsletterFetchUpdates(jid)`: har message ke views count aur reactions ki list
- **Reaction mode** — naya `newsletterReactionMode(jid, mode)`: apne channel ki reaction setting badlein
- **Crash fix** — jis channel ki picture na ho, us ki metadata par ab crash nahi hota

Purana `newsletterFetchMessages(jid, count, since, after)` wala andaaz bhi chalta rahega — library khud samajh jati hai.

## Bot mein istemal

```js
const makeWASocket = require('@qadeer-xtech/stablebail').default
const { useMultiFileAuthState, DisconnectReason } = require('@qadeer-xtech/stablebail')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({ auth: state, printQRInTerminal: true })
    sock.ev.on('creds.update', saveCreds)
    return sock
}
```

## Channel (Newsletter) ki misalein

```js
// Link se channel ki maloomat
const channel = await sock.newsletterFromUrl('https://whatsapp.com/channel/0029VbCCK3T5PO17Wu4r8U1A')
console.log(channel.id, channel.name, channel.subscribers)

// Follow / unfollow
await sock.newsletterFollow(channel.id)
await sock.newsletterUnfollow(channel.id)

// Mere saare subscribed channels
const list = await sock.newsletterSubscribed()

// Channel ke messages parhna (naya tareeqa / purana tareeqa — dono chalte hain)
const msgs = await sock.newsletterFetchMessages('jid', channel.id, 20)
const msgsOld = await sock.newsletterFetchMessages(channel.id, 20)

// Views + reactions
const updates = await sock.newsletterFetchUpdates(channel.id, 20)
console.log(updates[0].server_id, updates[0].views, updates[0].reactions)

// Channel par message / media bhejna (apna channel ho to)
await sock.sendMessage(channel.id, { text: 'Assalam o Alaikum!' })
await sock.sendMessage(channel.id, { image: { url: 'https://example.com/pic.jpg' }, caption: 'Nayi post' })

// Kisi message par reaction
await sock.newsletterReactMessage(channel.id, updates[0].server_id, '❤️')
```

## Versions

- **1.0.2** — Channels/newsletter fixes (upar wali list)
- **1.0.1** — Dependencies apne packages par: `@qadeer-xtech/libsignal`, `@qadeer-xtech/whatsapp-rust-bridge`
- **1.0.0** — Official Baileys 7.0.0-rc14 ki saaf copy

## License

MIT

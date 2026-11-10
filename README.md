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

## 1.0.3 mein kya fix hai (Media Stream Download)

rc14 (aur official master) mein media STREAM download ke ye hisse toote hue thay — 1.0.3 mein theek hain:

- **Stream error aage jata hai** — download darmiyan mein kate to pehle stream hamesha ke liye hang ho jati thi aur process par uncaughtException ata tha; ab error caller ko milta hai, download saaf fail hota hai, hang nahi (official issue #2750).
- **Purani media par reupload** — CDN 404/410 de to bot phone se reupload mangta hai; fetch (undici) migration ke baad status check kharab tha, reupload kabhi manga hi nahi jata tha (official issue #2767).
- **Expire link (403) par bhi reupload** — signed media link expire ho jaye (oe param) to 403 ata tha aur media hamesha ke liye fail; ab WhatsApp Web ki tarah reupload se naya link ata hai.
- **mediaKey string wala bug** — database/JSON se restore hue messages ki mediaKey base64 string hoti thi, jis se retry decryption fail hoti thi; ab pehle bytes mein badalti hai.

Baaki sab kuch 1.0.2 wala hi hai — API mein koi tabdeeli nahi, purana code waisa hi chalega.

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

- **1.0.3** — Media stream download fixes (upar wali list)
- **1.0.2** — Channels/newsletter fixes
- **1.0.1** — Dependencies apne packages par: `@qadeer-xtech/libsignal`, `@qadeer-xtech/whatsapp-rust-bridge`
- **1.0.0** — Official Baileys 7.0.0-rc14 ki saaf copy

## License

MIT

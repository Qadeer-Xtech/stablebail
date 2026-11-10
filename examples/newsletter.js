// Channels (newsletters): list the ones this account follows, read a
// channel's info and recent messages, and post a text update.
import makeWASocket, { useMultiFileAuthState } from '@qadeer-xtech/stablebail'

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)

sock.ev.on('connection.update', async ({ connection }) => {
	if (connection !== 'open') return

	const subs = await sock.newsletterFetchAllSubscribe()
	console.log('Followed channels:', subs)

	// Replace with a real channel JID (ends in @newsletter)
	const channelJid = '120363000000000000@newsletter'
	const meta = await sock.newsletterMetadata('jid', channelJid)
	console.log('Channel:', meta?.name || meta)

	const msgs = await sock.newsletterFetchMessages(channelJid, 10)
	console.log('Recent messages:', msgs?.length)

	await sock.sendMessage(channelJid, { text: 'Assalam o Alaikum!' })
})

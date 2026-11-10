// Post a status that mentions specific people (they get notified),
// using sendStatusMention - added in stablebail 1.0.5.
import makeWASocket, { useMultiFileAuthState } from '@qadeer-xtech/stablebail'

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)

sock.ev.on('connection.update', async ({ connection }) => {
	if (connection !== 'open') return

	await sock.sendStatusMention(
		['92XXXXXXXXXX@s.whatsapp.net'], // people to mention
		{ text: 'This status is for you!' }
	)
	console.log('Status posted with mention')
})

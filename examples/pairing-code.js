// Connect with a pairing code instead of scanning a QR.
// Run: node examples/pairing-code.js 92XXXXXXXXXX
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@qadeer-xtech/stablebail'
import { Boom } from '@hapi/boom'

const phone = process.argv[2]
if (!phone) {
	console.log('Usage: node examples/pairing-code.js <phone with country code, digits only>')
	process.exit(1)
}

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const sock = makeWASocket({ auth: state, printQRInTerminal: false })

if (!state.creds.registered) {
	// give the socket a moment to open before asking for the code
	await new Promise(r => setTimeout(r, 3000))
	const code = await sock.requestPairingCode(phone)
	console.log('Pairing code:', code)
}

sock.ev.on('creds.update', saveCreds)
sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
	if (connection === 'open') console.log('Connected:', sock.user.id)
	if (connection === 'close') {
		const code = new Boom(lastDisconnect?.error)?.output?.statusCode
		console.log('Closed, reconnect:', code !== DisconnectReason.loggedOut)
	}
})

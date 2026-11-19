import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeInMemoryStore } from '../../Store/make-in-memory-store'
import type { BaileysEventEmitter, WAMessage } from '../../Types'

type Listener = (payload: unknown) => void

const makeEventHarness = () => {
	const listeners = new Map<string, Set<Listener>>()
	const ev = {
		on(event: string, listener: Listener) {
			const eventListeners = listeners.get(event) || new Set<Listener>()
			eventListeners.add(listener)
			listeners.set(event, eventListeners)
		},
		off(event: string, listener: Listener) {
			listeners.get(event)?.delete(listener)
		},
		removeAllListeners(event: string) {
			listeners.delete(event)
		}
	} as unknown as BaileysEventEmitter

	return {
		ev,
		emit(event: string, payload: unknown) {
			for (const listener of listeners.get(event) || []) listener(payload)
		}
	}
}

const makeMessage = (jid: string, id: string, timestamp = 1): WAMessage =>
	({
		key: { remoteJid: jid, id, fromMe: false },
		message: { conversation: `message-${id}` },
		messageTimestamp: timestamp
	}) as unknown as WAMessage

describe('makeInMemoryStore', () => {
	it('binds chat, contact, and message events and exposes the messages', () => {
		const store = makeInMemoryStore()
		const events = makeEventHarness()
		store.bind(events.ev)

		const jid = '923000000000@s.whatsapp.net'
		const message = makeMessage(jid, 'message-1')
		events.emit('chats.upsert', [{ id: jid, conversationTimestamp: 1 }])
		events.emit('contacts.upsert', [{ id: jid, name: 'Test Contact' }])
		events.emit('messages.upsert', { messages: [message], type: 'notify' })

		expect(store.chats.get(jid)?.id).toBe(jid)
		expect(store.chats.all()).toHaveLength(1)
		expect(store.contacts[jid]?.name).toBe('Test Contact')
		expect(store.messages.get(jid)?.array).toHaveLength(1)
		expect(store.loadMessage(jid, 'message-1')?.message?.conversation).toBe('message-message-1')

		store.close()
	})

	it('applies message updates and individual or full-chat deletions', () => {
		const store = makeInMemoryStore()
		const events = makeEventHarness()
		store.bind(events.ev)
		const jid = '923000000001@s.whatsapp.net'
		const first = makeMessage(jid, 'first')
		const second = makeMessage(jid, 'second')

		events.emit('messages.upsert', { messages: [first, second], type: 'notify' })
		events.emit('messages.update', [{ key: first.key, update: { pushName: 'updated' } }])
		expect(store.loadMessage(jid, 'first')?.pushName).toBe('updated')

		events.emit('messages.delete', { keys: [first.key] })
		expect(store.loadMessage(jid, 'first')).toBeUndefined()
		expect(store.loadMessage(jid, 'second')).toBeDefined()

		events.emit('messages.delete', { jid, all: true })
		expect(store.messages.get(jid)?.array).toHaveLength(0)
		store.close()
	})

	it('keeps only the configured number of messages in each chat', () => {
		const store = makeInMemoryStore({ maxMessagesPerChat: 2 })
		const jid = '923000000002@s.whatsapp.net'
		store.messages.upsert(makeMessage(jid, 'one'))
		store.messages.upsert(makeMessage(jid, 'two'))
		store.messages.upsert(makeMessage(jid, 'three'))

		expect(store.loadMessage(jid, 'one')).toBeUndefined()
		expect(store.loadMessage(jid, 'two')).toBeDefined()
		expect(store.loadMessage(jid, 'three')).toBeDefined()
	})

	it('persists and restores messages containing binary media keys', () => {
		const directory = mkdtempSync(join(tmpdir(), 'store-'))
		const filePath = join(directory, 'store.json')
		const store = makeInMemoryStore()
		const jid = '923000000003@s.whatsapp.net'
		const mediaKey = Buffer.from([0, 1, 127, 255])
		const binaryMessage = {
			...makeMessage(jid, 'media-1'),
			message: { imageMessage: { mediaKey } }
		} as unknown as WAMessage

		try {
			store.messages.upsert(binaryMessage)
			store.writeToFile(filePath)

			const restored = makeInMemoryStore()
			restored.readFromFile(filePath)
			const restoredMediaKey = restored.loadMessage(jid, 'media-1')?.message?.imageMessage?.mediaKey
			expect(Buffer.isBuffer(restoredMediaKey)).toBe(true)
			expect(restoredMediaKey).toEqual(mediaKey)
		} finally {
			rmSync(directory, { recursive: true, force: true })
		}
	})

	it('unbinds its event listeners when closed', () => {
		const store = makeInMemoryStore()
		const events = makeEventHarness()
		store.bind(events.ev)
		store.close()
		events.emit('messages.upsert', { messages: [makeMessage('jid@s.whatsapp.net', 'ignored')], type: 'notify' })
		expect(store.loadMessage('jid@s.whatsapp.net', 'ignored')).toBeUndefined()
	})
})

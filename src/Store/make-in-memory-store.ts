import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
	BaileysEventEmitter,
	BaileysEventMap,
	Chat,
	ChatUpdate,
	Contact,
	WAMessage,
	WAMessageKey,
	WAMessageUpdate
} from '../Types'

export type InMemoryStoreOptions = {
	/** Maximum messages retained per chat. Defaults to 1000. */
	maxMessagesPerChat?: number
}

type PersistedStore = {
	chats: Chat[]
	contacts: Contact[]
	messages: Record<string, WAMessage[]>
}

const messageTimestamp = (message: WAMessage): number => {
	const timestamp = message.messageTimestamp as unknown
	if (timestamp && typeof timestamp === 'object' && 'toNumber' in timestamp) {
		const toNumber = (timestamp as { toNumber?: () => number }).toNumber
		if (typeof toNumber === 'function') return toNumber.call(timestamp)
	}

	return Number(timestamp ?? 0)
}

class MemoryChatCollection {
	private readonly records = new Map<string, Chat>()

	get(id: string): Chat | undefined {
		return this.records.get(id)
	}

	all(): Chat[] {
		return [...this.records.values()]
	}

	upsert(chats: Chat[]): void {
		for (const chat of chats) {
			if (!chat.id) continue
			const current = this.records.get(chat.id)
			this.records.set(chat.id, current ? ({ ...current, ...chat } as Chat) : chat)
		}
	}

	update(chats: ChatUpdate[]): void {
		for (const update of chats) {
			if (!update.id) continue
			const current = this.records.get(update.id) || ({ id: update.id } as Chat)
			const patch = { ...update }
			delete patch.conditional
			delete patch.timestamp
			this.records.set(update.id, { ...current, ...patch } as Chat)
		}
	}

	delete(ids: string[]): void {
		for (const id of ids) this.records.delete(id)
	}

	clear(): void {
		this.records.clear()
	}

	toJSON(): Chat[] {
		return this.all()
	}
}

export class MemoryMessageBucket {
	private readonly records = new Map<string, WAMessage>()

	constructor(private readonly maxMessages: number) {}

	get array(): WAMessage[] {
		return [...this.records.values()]
	}

	get(id: string): WAMessage | undefined {
		return this.records.get(id)
	}

	upsert(message: WAMessage): void {
		const id = message.key?.id
		if (!id) return
		this.records.delete(id)
		this.records.set(id, message)
		while (this.records.size > this.maxMessages) {
			const oldestId = this.records.keys().next().value as string | undefined
			if (!oldestId) break
			this.records.delete(oldestId)
		}
	}

	update(id: string, update: Partial<WAMessage>): void {
		const current = this.records.get(id)
		if (!current) return
		this.records.set(id, { ...current, ...update, key: { ...current.key, ...(update.key || {}) } } as WAMessage)
	}

	delete(ids: string[]): void {
		for (const id of ids) this.records.delete(id)
	}

	clear(): void {
		this.records.clear()
	}

	toJSON(): WAMessage[] {
		return this.array
	}
}

class MemoryMessageCollections {
	private readonly chats = new Map<string, MemoryMessageBucket>()

	constructor(private readonly maxMessagesPerChat: number) {}

	get(jid: string): MemoryMessageBucket | undefined {
		return this.chats.get(jid)
	}

	getOrCreate(jid: string): MemoryMessageBucket {
		let bucket = this.chats.get(jid)
		if (!bucket) {
			bucket = new MemoryMessageBucket(this.maxMessagesPerChat)
			this.chats.set(jid, bucket)
		}

		return bucket
	}

	upsert(message: WAMessage): void {
		const jid = message.key?.remoteJid
		if (jid) this.getOrCreate(jid).upsert(message)
	}

	update(update: WAMessageUpdate): void {
		const jid = update.key.remoteJid
		const id = update.key.id
		if (jid && id) this.chats.get(jid)?.update(id, update.update)
	}

	delete(keys: WAMessageKey[]): void {
		for (const key of keys) {
			if (key.remoteJid && key.id) this.chats.get(key.remoteJid)?.delete([key.id])
		}
	}

	deleteChat(jid: string): void {
		this.chats.delete(jid)
	}

	deleteAll(jid: string): void {
		this.chats.get(jid)?.clear()
	}

	clear(): void {
		this.chats.clear()
	}

	all(): Record<string, WAMessage[]> {
		return Object.fromEntries([...this.chats.entries()].map(([jid, bucket]) => [jid, bucket.array]))
	}

	toJSON(): Record<string, WAMessage[]> {
		return this.all()
	}

	loadFromObject(value: unknown): void {
		this.clear()
		if (!value || typeof value !== 'object') return
		for (const [jid, messages] of Object.entries(value as Record<string, unknown>)) {
			if (!Array.isArray(messages)) continue
			const bucket = this.getOrCreate(jid)
			for (const message of messages) {
				if (message && typeof message === 'object') bucket.upsert(message as WAMessage)
			}
		}
	}
}

/**
 * Optional in-memory chat/contact/message store.
 *
 * Bind it to sock.ev, then use store.loadMessage(jid, id) as the socket's getMessage
 * callback when creating a socket. File reads/writes are synchronous for compatibility
 * with the traditional Baileys store API; call them outside latency-sensitive handlers.
 */
export const makeInMemoryStore = (options: InMemoryStoreOptions = {}) => {
	const maxMessages =
		Number.isInteger(options.maxMessagesPerChat) && (options.maxMessagesPerChat as number) > 0
			? (options.maxMessagesPerChat as number)
			: 1000

	const chats = new MemoryChatCollection()
	const messages = new MemoryMessageCollections(maxMessages)
	const contacts = Object.create(null) as Record<string, Contact>
	let removeListeners: () => void = () => {}

	const clearContacts = () => {
		for (const id of Object.keys(contacts)) delete contacts[id]
	}

	const upsertContacts = (items: Contact[]) => {
		for (const contact of items) {
			if (contact.id) contacts[contact.id] = { ...contacts[contact.id], ...contact }
		}
	}

	const updateContacts = (items: Partial<Contact>[]) => {
		for (const contact of items) {
			if (contact.id) contacts[contact.id] = { ...contacts[contact.id], ...contact } as Contact
		}
	}

	const store = {
		chats,
		contacts,
		messages,

		bind(ev: BaileysEventEmitter): () => void {
			removeListeners()
			const cleanups: Array<() => void> = []
			const listen = <K extends keyof BaileysEventMap>(event: K, listener: (payload: BaileysEventMap[K]) => void) => {
				ev.on(event, listener)
				cleanups.push(() => ev.off(event, listener))
			}

			listen('messaging-history.set', data => {
				chats.upsert(data.chats)
				upsertContacts(data.contacts)
				for (const message of data.messages) messages.upsert(message)
			})
			listen('chats.upsert', data => chats.upsert(data))
			listen('chats.update', data => chats.update(data))
			listen('chats.delete', data => {
				chats.delete(data)
				for (const jid of data) messages.deleteChat(jid)
			})
			listen('contacts.upsert', data => upsertContacts(data))
			listen('contacts.update', data => updateContacts(data))
			listen('messages.upsert', data => {
				for (const message of data.messages) messages.upsert(message)
			})
			listen('messages.update', data => {
				for (const update of data) messages.update(update)
			})
			listen('messages.delete', data => {
				if ('all' in data && data.all) messages.deleteAll(data.jid)
				else if ('keys' in data) messages.delete(data.keys)
			})

			removeListeners = () => {
				for (const cleanup of cleanups.splice(0)) cleanup()
			}

			return removeListeners
		},

		unbind(): void {
			removeListeners()
			removeListeners = () => {}
		},

		loadMessage(jid: string, id: string): WAMessage | undefined {
			return messages.get(jid)?.get(id)
		},

		mostRecentMessage(jid: string): WAMessage | undefined {
			return messages.get(jid)?.array.sort((a, b) => messageTimestamp(b) - messageTimestamp(a))[0]
		},

		readFromFile(filePath: string): void {
			if (!existsSync(filePath)) return
			const parsed = JSON.parse(readFileSync(filePath, 'utf8'), (_key, value) => {
				if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
				if (value && value.__stablebailStoreType === 'Uint8Array' && Array.isArray(value.data)) {
					return Uint8Array.from(value.data)
				}

				return value
			}) as Partial<PersistedStore>

			chats.clear()
			chats.upsert(Array.isArray(parsed.chats) ? parsed.chats : [])
			clearContacts()
			if (Array.isArray(parsed.contacts)) upsertContacts(parsed.contacts)
			else if (parsed.contacts && typeof parsed.contacts === 'object') {
				upsertContacts(Object.values(parsed.contacts) as Contact[])
			}

			messages.loadFromObject(parsed.messages)
		},

		writeToFile(filePath: string): void {
			const state: PersistedStore = {
				chats: chats.all(),
				contacts: Object.values(contacts),
				messages: messages.toJSON()
			}
			const serialized = JSON.stringify(state, (_key, value) => {
				if (value instanceof Uint8Array && !Buffer.isBuffer(value)) {
					return { __stablebailStoreType: 'Uint8Array', data: Array.from(value) }
				}

				return value
			})
			const temporaryPath = filePath + '.' + process.pid + '.' + randomUUID() + '.tmp'
			mkdirSync(dirname(filePath), { recursive: true })
			try {
				writeFileSync(temporaryPath, serialized, 'utf8')
				renameSync(temporaryPath, filePath)
			} catch (error) {
				try {
					rmSync(temporaryPath, { force: true })
				} catch {
					// Preserve the original write/rename error.
				}

				throw error
			}
		},

		toJSON(): PersistedStore {
			return {
				chats: chats.all(),
				contacts: Object.values(contacts),
				messages: messages.toJSON()
			}
		},

		close(): void {
			removeListeners()
			removeListeners = () => {}
		}
	}

	return store
}

export type InMemoryStore = ReturnType<typeof makeInMemoryStore>

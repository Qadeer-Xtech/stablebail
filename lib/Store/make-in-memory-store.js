import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const messageTimestamp = (message) => {
    const timestamp = message.messageTimestamp;
    if (timestamp && typeof timestamp === 'object' && 'toNumber' in timestamp) {
        const toNumber = timestamp.toNumber;
        if (typeof toNumber === 'function')
            return toNumber.call(timestamp);
    }
    return Number(timestamp ?? 0);
};
class MemoryChatCollection {
    constructor() {
        this.records = new Map();
    }
    get(id) {
        return this.records.get(id);
    }
    all() {
        return [...this.records.values()];
    }
    upsert(chats) {
        for (const chat of chats) {
            if (!chat.id)
                continue;
            const current = this.records.get(chat.id);
            this.records.set(chat.id, current ? { ...current, ...chat } : chat);
        }
    }
    update(chats) {
        for (const update of chats) {
            if (!update.id)
                continue;
            const current = this.records.get(update.id) || { id: update.id };
            const patch = { ...update };
            delete patch.conditional;
            delete patch.timestamp;
            this.records.set(update.id, { ...current, ...patch });
        }
    }
    delete(ids) {
        for (const id of ids)
            this.records.delete(id);
    }
    clear() {
        this.records.clear();
    }
    toJSON() {
        return this.all();
    }
}
export class MemoryMessageBucket {
    constructor(maxMessages) {
        this.maxMessages = maxMessages;
        this.records = new Map();
    }
    get array() {
        return [...this.records.values()];
    }
    get(id) {
        return this.records.get(id);
    }
    upsert(message) {
        const id = message.key?.id;
        if (!id)
            return;
        this.records.delete(id);
        this.records.set(id, message);
        while (this.records.size > this.maxMessages) {
            const oldestId = this.records.keys().next().value;
            if (!oldestId)
                break;
            this.records.delete(oldestId);
        }
    }
    update(id, update) {
        const current = this.records.get(id);
        if (!current)
            return;
        this.records.set(id, { ...current, ...update, key: { ...current.key, ...(update.key || {}) } });
    }
    delete(ids) {
        for (const id of ids)
            this.records.delete(id);
    }
    clear() {
        this.records.clear();
    }
    toJSON() {
        return this.array;
    }
}
class MemoryMessageCollections {
    constructor(maxMessagesPerChat) {
        this.maxMessagesPerChat = maxMessagesPerChat;
        this.chats = new Map();
    }
    get(jid) {
        return this.chats.get(jid);
    }
    getOrCreate(jid) {
        let bucket = this.chats.get(jid);
        if (!bucket) {
            bucket = new MemoryMessageBucket(this.maxMessagesPerChat);
            this.chats.set(jid, bucket);
        }
        return bucket;
    }
    upsert(message) {
        const jid = message.key?.remoteJid;
        if (jid)
            this.getOrCreate(jid).upsert(message);
    }
    update(update) {
        const jid = update.key.remoteJid;
        const id = update.key.id;
        if (jid && id)
            this.chats.get(jid)?.update(id, update.update);
    }
    delete(keys) {
        for (const key of keys) {
            if (key.remoteJid && key.id)
                this.chats.get(key.remoteJid)?.delete([key.id]);
        }
    }
    deleteChat(jid) {
        this.chats.delete(jid);
    }
    deleteAll(jid) {
        this.chats.get(jid)?.clear();
    }
    clear() {
        this.chats.clear();
    }
    all() {
        return Object.fromEntries([...this.chats.entries()].map(([jid, bucket]) => [jid, bucket.array]));
    }
    toJSON() {
        return this.all();
    }
    loadFromObject(value) {
        this.clear();
        if (!value || typeof value !== 'object')
            return;
        for (const [jid, messages] of Object.entries(value)) {
            if (!Array.isArray(messages))
                continue;
            const bucket = this.getOrCreate(jid);
            for (const message of messages) {
                if (message && typeof message === 'object')
                    bucket.upsert(message);
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
export const makeInMemoryStore = (options = {}) => {
    const maxMessages = Number.isInteger(options.maxMessagesPerChat) && options.maxMessagesPerChat > 0
        ? options.maxMessagesPerChat
        : 1000;
    const chats = new MemoryChatCollection();
    const messages = new MemoryMessageCollections(maxMessages);
    const contacts = Object.create(null);
    let removeListeners = () => { };
    const clearContacts = () => {
        for (const id of Object.keys(contacts))
            delete contacts[id];
    };
    const upsertContacts = (items) => {
        for (const contact of items) {
            if (contact.id)
                contacts[contact.id] = { ...contacts[contact.id], ...contact };
        }
    };
    const updateContacts = (items) => {
        for (const contact of items) {
            if (contact.id)
                contacts[contact.id] = { ...contacts[contact.id], ...contact };
        }
    };
    const store = {
        chats,
        contacts,
        messages,
        bind(ev) {
            removeListeners();
            const cleanups = [];
            const listen = (event, listener) => {
                ev.on(event, listener);
                cleanups.push(() => ev.off(event, listener));
            };
            listen('messaging-history.set', data => {
                chats.upsert(data.chats);
                upsertContacts(data.contacts);
                for (const message of data.messages)
                    messages.upsert(message);
            });
            listen('chats.upsert', data => chats.upsert(data));
            listen('chats.update', data => chats.update(data));
            listen('chats.delete', data => {
                chats.delete(data);
                for (const jid of data)
                    messages.deleteChat(jid);
            });
            listen('contacts.upsert', data => upsertContacts(data));
            listen('contacts.update', data => updateContacts(data));
            listen('messages.upsert', data => {
                for (const message of data.messages)
                    messages.upsert(message);
            });
            listen('messages.update', data => {
                for (const update of data)
                    messages.update(update);
            });
            listen('messages.delete', data => {
                if ('all' in data && data.all)
                    messages.deleteAll(data.jid);
                else if ('keys' in data)
                    messages.delete(data.keys);
            });
            removeListeners = () => {
                for (const cleanup of cleanups.splice(0))
                    cleanup();
            };
            return removeListeners;
        },
        unbind() {
            removeListeners();
            removeListeners = () => { };
        },
        loadMessage(jid, id) {
            return messages.get(jid)?.get(id);
        },
        mostRecentMessage(jid) {
            return messages.get(jid)?.array.sort((a, b) => messageTimestamp(b) - messageTimestamp(a))[0];
        },
        readFromFile(filePath) {
            if (!existsSync(filePath))
                return;
            const parsed = JSON.parse(readFileSync(filePath, 'utf8'), (_key, value) => {
                if (value && value.type === 'Buffer' && Array.isArray(value.data))
                    return Buffer.from(value.data);
                if (value && value.__stablebailStoreType === 'Uint8Array' && Array.isArray(value.data)) {
                    return Uint8Array.from(value.data);
                }
                return value;
            });
            chats.clear();
            chats.upsert(Array.isArray(parsed.chats) ? parsed.chats : []);
            clearContacts();
            if (Array.isArray(parsed.contacts))
                upsertContacts(parsed.contacts);
            else if (parsed.contacts && typeof parsed.contacts === 'object') {
                upsertContacts(Object.values(parsed.contacts));
            }
            messages.loadFromObject(parsed.messages);
        },
        writeToFile(filePath) {
            const state = {
                chats: chats.all(),
                contacts: Object.values(contacts),
                messages: messages.toJSON()
            };
            const serialized = JSON.stringify(state, (_key, value) => {
                if (value instanceof Uint8Array && !Buffer.isBuffer(value)) {
                    return { __stablebailStoreType: 'Uint8Array', data: Array.from(value) };
                }
                return value;
            });
            const temporaryPath = filePath + '.' + process.pid + '.' + randomUUID() + '.tmp';
            mkdirSync(dirname(filePath), { recursive: true });
            try {
                writeFileSync(temporaryPath, serialized, 'utf8');
                renameSync(temporaryPath, filePath);
            }
            catch (error) {
                try {
                    rmSync(temporaryPath, { force: true });
                }
                catch {
                    // Preserve the original write/rename error.
                }
                throw error;
            }
        },
        toJSON() {
            return {
                chats: chats.all(),
                contacts: Object.values(contacts),
                messages: messages.toJSON()
            };
        },
        close() {
            removeListeners();
            removeListeners = () => { };
        }
    };
    return store;
};
//# sourceMappingURL=make-in-memory-store.js.map
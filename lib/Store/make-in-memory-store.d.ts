import type { BaileysEventEmitter, Chat, ChatUpdate, Contact, WAMessage, WAMessageKey, WAMessageUpdate } from '../Types/index.js';
export type InMemoryStoreOptions = {
    /** Maximum messages retained per chat. Defaults to 1000. */
    maxMessagesPerChat?: number;
};
type PersistedStore = {
    chats: Chat[];
    contacts: Contact[];
    messages: Record<string, WAMessage[]>;
};
declare class MemoryChatCollection {
    private readonly records;
    get(id: string): Chat | undefined;
    all(): Chat[];
    upsert(chats: Chat[]): void;
    update(chats: ChatUpdate[]): void;
    delete(ids: string[]): void;
    clear(): void;
    toJSON(): Chat[];
}
export declare class MemoryMessageBucket {
    private readonly maxMessages;
    private readonly records;
    constructor(maxMessages: number);
    get array(): WAMessage[];
    get(id: string): WAMessage | undefined;
    upsert(message: WAMessage): void;
    update(id: string, update: Partial<WAMessage>): void;
    delete(ids: string[]): void;
    clear(): void;
    toJSON(): WAMessage[];
}
declare class MemoryMessageCollections {
    private readonly maxMessagesPerChat;
    private readonly chats;
    constructor(maxMessagesPerChat: number);
    get(jid: string): MemoryMessageBucket | undefined;
    getOrCreate(jid: string): MemoryMessageBucket;
    upsert(message: WAMessage): void;
    update(update: WAMessageUpdate): void;
    delete(keys: WAMessageKey[]): void;
    deleteChat(jid: string): void;
    deleteAll(jid: string): void;
    clear(): void;
    all(): Record<string, WAMessage[]>;
    toJSON(): Record<string, WAMessage[]>;
    loadFromObject(value: unknown): void;
}
/**
 * Optional in-memory chat/contact/message store.
 *
 * Bind it to sock.ev, then use store.loadMessage(jid, id) as the socket's getMessage
 * callback when creating a socket. File reads/writes are synchronous for compatibility
 * with the traditional Baileys store API; call them outside latency-sensitive handlers.
 */
export declare const makeInMemoryStore: (options?: InMemoryStoreOptions) => {
    chats: MemoryChatCollection;
    contacts: Record<string, Contact>;
    messages: MemoryMessageCollections;
    bind(ev: BaileysEventEmitter): () => void;
    unbind(): void;
    loadMessage(jid: string, id: string): WAMessage | undefined;
    mostRecentMessage(jid: string): WAMessage | undefined;
    readFromFile(filePath: string): void;
    writeToFile(filePath: string): void;
    toJSON(): PersistedStore;
    close(): void;
};
export type InMemoryStore = ReturnType<typeof makeInMemoryStore>;
export {};
//# sourceMappingURL=make-in-memory-store.d.ts.map
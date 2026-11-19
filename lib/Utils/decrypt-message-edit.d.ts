import { proto } from '../../WAProto/index.js';
export type MessageEditContext = {
    originalSenderJid: string;
    originalMsgId: string;
    messageSecret: Uint8Array;
    editorJid: string;
};
export declare const isEncryptedMessageEdit: (content: proto.IMessage | null | undefined) => content is proto.IMessage & {
    secretEncryptedMessage: proto.Message.ISecretEncryptedMessage;
};
/** Decrypts an authenticated WhatsApp MESSAGE_EDIT add-on. */
export declare const decryptMessageEdit: ({ encPayload, encIv }: proto.Message.ISecretEncryptedMessage, { originalSenderJid, originalMsgId, messageSecret, editorJid }: MessageEditContext) => proto.Message;
//# sourceMappingURL=decrypt-message-edit.d.ts.map
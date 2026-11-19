import { proto } from '../../WAProto/index.js';
import { jidNormalizedUser } from '../WABinary/index.js';
import { aesDecryptGCM, hmacSign } from './crypto.js';
export const isEncryptedMessageEdit = (content) => content?.secretEncryptedMessage?.secretEncType === proto.Message.SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT;
/** Decrypts an authenticated WhatsApp MESSAGE_EDIT add-on. */
export const decryptMessageEdit = ({ encPayload, encIv }, { originalSenderJid, originalMsgId, messageSecret, editorJid }) => {
    if (messageSecret.byteLength !== 32) {
        throw new Error(`Invalid MESSAGE_EDIT message secret length: expected 32, got ${messageSecret.byteLength}`);
    }
    if (!encPayload?.length) {
        throw new Error('Invalid MESSAGE_EDIT payload: missing encrypted content');
    }
    if (encIv?.length !== 12) {
        throw new Error(`Invalid MESSAGE_EDIT IV length: expected 12, got ${encIv?.length ?? 0}`);
    }
    const normalizedSender = jidNormalizedUser(originalSenderJid);
    const normalizedEditor = jidNormalizedUser(editorJid);
    if (!normalizedSender || !normalizedEditor || !originalMsgId) {
        throw new Error('Invalid MESSAGE_EDIT context: sender, editor and original message ID are required');
    }
    const info = Buffer.concat([
        Buffer.from(originalMsgId),
        Buffer.from(normalizedSender),
        Buffer.from(normalizedEditor),
        Buffer.from('Message Edit'),
        new Uint8Array([1])
    ]);
    const extractedKey = hmacSign(messageSecret, new Uint8Array(32), 'sha256');
    const decryptionKey = hmacSign(info, extractedKey, 'sha256');
    const plaintext = aesDecryptGCM(encPayload, decryptionKey, encIv, new Uint8Array(0));
    return proto.Message.decode(plaintext);
};
//# sourceMappingURL=decrypt-message-edit.js.map
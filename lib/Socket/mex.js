import { Boom } from '@hapi/boom';
import { getBinaryNodeChild, S_WHATSAPP_NET } from '../WABinary/index.js';
const wMexQuery = (variables, queryId, query, generateMessageTag) => {
    return query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            to: S_WHATSAPP_NET,
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    });
};
// The WMex result body is normally plain JSON text, but the server sometimes
// answers with a compact binary payload instead. Read the body tolerantly:
// try it as-is first, then from the first '{' onward.
const parseWMexBody = (content) => {
    if (!content || Array.isArray(content)) {
        return null;
    }
    const raw = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    const candidates = [raw.trim()];
    const firstBrace = raw.indexOf('{');
    if (firstBrace > 0) {
        candidates.push(raw.slice(firstBrace).trim());
    }
    for (const candidate of candidates) {
        if (!candidate.startsWith('{')) {
            continue;
        }
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            // Not plain JSON at this boundary; try the next candidate.
        }
    }
    return null;
};
// The compact binary form of a newsletter metadata answer is a sequence of
// length-headed fields: a 0x04 marker byte, then for each field a varint
// header whose value is twice the field's byte length, followed by the raw
// field bytes. The fields are, in order: a head record (channel id, picture
// id and timestamps as plain text), the channel state, a thread record
// (creation time, name, picture paths, description, an update timestamp, the
// invite code and the subscriber count as plain text), a few short status
// strings and an opaque tail. Decode it back into the JSON shape the
// metadata parser already understands.
const readBinaryVarint = (buf, offset) => {
    let value = 0;
    let shift = 0;
    let i = offset;
    while (i < buf.length) {
        const byte = buf[i];
        i += 1;
        value += (byte & 0x7f) * 2 ** shift;
        if (!(byte & 0x80)) {
            return { value, next: i };
        }
        shift += 7;
        if (shift > 28) {
            return null;
        }
    }
    return null;
};
const splitBinaryFields = (buf) => {
    if (buf.length < 2 || buf[0] !== 4) {
        return null;
    }
    const fields = [];
    let i = 1;
    while (i < buf.length) {
        const header = readBinaryVarint(buf, i);
        if (!header) {
            return null;
        }
        const length = Math.floor(header.value / 2);
        const end = header.next + length;
        if (end > buf.length) {
            return null;
        }
        fields.push(buf.subarray(header.next, end));
        i = end;
    }
    return fields.length >= 3 ? fields : null;
};
const URL_CHARS = /^[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+/;
const decodeBinaryThread = (field) => {
    // Field boundaries are located through latin1 (one byte per index); the
    // text values are then decoded as UTF-8 from their byte ranges.
    const raw = field.toString('latin1');
    const creation = raw.match(/^(\d{10})/)?.[1];
    let rest = creation ? raw.slice(10) : raw;
    let name;
    let description;
    let picture;
    const pictureMarker = '/m1/v/t24/';
    const pictureAt = rest.indexOf(pictureMarker);
    if (pictureAt >= 0) {
        let start = pictureAt;
        while (start > 0 && /\d/.test(rest[start - 1])) {
            start -= 1;
        }
        name = Buffer.from(rest.slice(0, start), 'latin1').toString('utf-8');
        const urlRegion = rest.slice(start).match(URL_CHARS)?.[0] || '';
        const firstAt = urlRegion.indexOf(pictureMarker);
        const secondAt = firstAt >= 0 ? urlRegion.indexOf(pictureMarker, firstAt + pictureMarker.length) : -1;
        const full = secondAt > 0 ? urlRegion.slice(0, secondAt) : urlRegion;
        const directPath = full.replace(/^\d+/, '');
        const pictureId = full.match(/^(\d+)/)?.[1];
        if (directPath.startsWith(pictureMarker) && pictureId) {
            picture = { id: pictureId, direct_path: directPath };
        }
        rest = rest.slice(start + urlRegion.length);
    }
    // The thread record ends with a fixed tail: a 16-digit update timestamp,
    // the channel's own invite code, and the subscriber count. Anchor on
    // that tail — the description text itself may contain other channels'
    // invite links, which must not be mistaken for this channel's code.
    let invite;
    let subscribers;
    const tailMatch = rest.match(/(\d{16})(0029[A-Za-z0-9]{20})(\d{1,10})?$/);
    if (tailMatch && typeof tailMatch.index === 'number') {
        invite = tailMatch[2];
        subscribers = tailMatch[3];
        // The description is only separable from the name when the picture
        // paths marked the boundary; without them, leave it unset rather
        // than returning the two merged together.
        const before = rest.slice(0, tailMatch.index);
        if (typeof name === 'string' && before) {
            description = Buffer.from(before, 'latin1').toString('utf-8');
        }
    }
    const thread = {};
    if (creation) {
        thread.creation_time = creation;
    }
    if (name) {
        thread.name = { text: name };
    }
    if (description) {
        thread.description = { text: description };
    }
    if (invite) {
        thread.invite = invite;
    }
    if (subscribers) {
        thread.subscribers_count = subscribers;
    }
    if (picture) {
        thread.picture = picture;
    }
    return Object.keys(thread).length ? thread : null;
};
export const decodeBinaryNewsletterMetadata = (content) => {
    if (!content || Array.isArray(content) || typeof content === 'string') {
        return null;
    }
    const fields = splitBinaryFields(Buffer.from(content));
    if (!fields) {
        return null;
    }
    const headMatch = fields[0].toString('latin1').match(/^(\d{6,}@newsletter)/);
    if (!headMatch) {
        return null;
    }
    const thread = decodeBinaryThread(fields[2]);
    if (!thread) {
        return { id: headMatch[1] };
    }
    const verification = fields[4]?.toString('utf-8');
    if (verification === 'VERIFIED' || verification === 'UNVERIFIED') {
        thread.verification = verification;
    }
    // The metadata parser reads name/description text and viewer metadata
    // unconditionally, exactly as the JSON answer provides them; fill the
    // same defaults so a missing piece decodes as empty instead of throwing.
    if (!thread.name) {
        thread.name = { text: '' };
    }
    if (!thread.description) {
        thread.description = { text: '' };
    }
    return { id: headMatch[1], thread_metadata: thread, viewer_metadata: {} };
};
// When a newsletter metadata answer arrives as a binary payload, the channel
// id is still carried inside it. Scan the whole result node (attrs and
// content, recursively) and recover the id when exactly one is present.
const recoverNewsletterId = (node) => {
    const found = new Set();
    const scan = (value) => {
        if (typeof value !== 'string' && !(value instanceof Uint8Array)) {
            return;
        }
        const text = typeof value === 'string' ? value : Buffer.from(value).toString('latin1');
        for (const match of text.matchAll(/(?<![0-9])(120363\d{7,18})(?![0-9])/g)) {
            found.add(`${match[1]}@newsletter`);
        }
    };
    const visit = (current, depth) => {
        if (!current || depth > 8) {
            return;
        }
        for (const value of Object.values(current.attrs || {})) {
            scan(value);
        }
        if (Array.isArray(current.content)) {
            for (const childNode of current.content) {
                visit(childNode, depth + 1);
            }
        }
        else {
            scan(current.content);
        }
    };
    visit(node, 0);
    return found.size === 1 ? [...found][0] : null;
};
export const executeWMexQuery = async (variables, queryId, dataPath, query, generateMessageTag) => {
    const result = await wMexQuery(variables, queryId, query, generateMessageTag);
    const child = getBinaryNodeChild(result, 'result');
    if (child?.content) {
        const data = parseWMexBody(child.content);
        if (!data) {
            // Binary payload instead of JSON. Only the newsletter metadata
            // lookup may decode it (with the channel id as the last-resort
            // fallback); every other query reports a clean parse failure.
            if (dataPath === 'xwa2_newsletter_metadata') {
                const decoded = decodeBinaryNewsletterMetadata(child.content);
                if (decoded) {
                    return decoded;
                }
                const id = recoverNewsletterId(child);
                if (id) {
                    return { id };
                }
            }
            throw new Boom('Failed to parse WMex response.', { statusCode: 502, data: result });
        }
        if (data.errors && data.errors.length > 0) {
            const errorMessages = data.errors.map(err => err.message || 'Unknown error').join(', ');
            const firstError = data.errors[0];
            const errorCode = firstError?.extensions?.error_code || 400;
            throw new Boom(`GraphQL server error: ${errorMessages}`, { statusCode: errorCode, data: firstError });
        }
        const response = dataPath ? data?.data?.[dataPath] : data?.data;
        if (typeof response !== 'undefined') {
            return response;
        }
    }
    const action = (dataPath || '').startsWith('xwa2_')
        ? dataPath.substring(5).replace(/_/g, ' ')
        : dataPath?.replace(/_/g, ' ');
    throw new Boom(`Failed to ${action}, unexpected response structure.`, { statusCode: 400, data: result });
};
//# sourceMappingURL=mex.js.map
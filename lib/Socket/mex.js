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
            // lookup may fall back to recovering the channel id from it;
            // every other query reports a clean parse failure.
            if (dataPath === 'xwa2_newsletter_metadata') {
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
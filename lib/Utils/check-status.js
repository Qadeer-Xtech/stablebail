import { randomUUID } from 'crypto';
import { initAuthCreds } from './auth-utils.js';
/**
 * checkStatusWA — standalone WhatsApp number status checker.
 *
 * NOTE: This is an EXTRA utility shipped with stablebail; it is not part of
 * upstream Baileys. It does not need a connected socket or a real account.
 *
 * How it works: WhatsApp's mobile registration endpoint (`/v2/exist`) is
 * asked — using a throwaway, freshly generated identity — whether a number
 * may register. The endpoint's answer distinguishes a healthy number from a
 * banned one: for a banned number it returns an `appeal_token`, which can
 * optionally be exchanged against WhatsApp's ban-appeal GraphQL endpoint
 * for ban details (ban time, appeal state, permanent vs temporary).
 *
 * Treat the result as a best-effort signal, not an official verdict:
 * WhatsApp rate-limits this endpoint, and its responses can change.
 */
const REGISTRATION_BASE_URL = 'https://v.whatsapp.net/v2';
const REGISTRATION_USER_AGENT = 'WhatsApp/2.24.12.78 iOS/17.5.1 Device/Apple-iPhone_13';
const APPEAL_GRAPHQL_URL = 'https://graph.whatsapp.com/graphql';
const APPEAL_STATUS_DOC_ID = '25573756098908502';
const COUNTRY_CALLING_CODES = [
    '1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45',
    '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63',
    '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98', '212',
    '213', '216', '218', '220', '221', '234', '254', '351', '352', '353', '354', '358', '380',
    '880', '966', '971', '972', '973', '974', '977'
];
/** Split international digits into { countryCode, nationalNumber } by longest prefix match. */
export const parsePhoneNumberParts = (digits) => {
    for (const prefix of [...COUNTRY_CALLING_CODES].sort((a, b) => b.length - a.length)) {
        if (digits.startsWith(prefix)) {
            return { countryCode: prefix, nationalNumber: digits.slice(prefix.length) };
        }
    }
    return { countryCode: digits.slice(0, 2), nationalNumber: digits.slice(2) };
};
const buildExistParams = (creds, countryCode, nationalNumber) => {
    const regId = Buffer.alloc(4);
    regId.writeInt32BE(creds.registrationId || 0);
    const signedKeyId = Buffer.alloc(3);
    signedKeyId.writeUInt16BE((creds.signedPreKey?.keyId || 1) & 0xffff, 1);
    const params = {
        cc: countryCode,
        in: nationalNumber,
        Rc: '0',
        lg: 'en',
        lc: 'GB',
        mistyped: '6',
        authkey: Buffer.from(creds.noiseKey.public).toString('base64url'),
        e_regid: regId.toString('base64url'),
        e_keytype: 'BQ',
        e_ident: Buffer.from(creds.signedIdentityKey.public).toString('base64url'),
        e_skey_id: signedKeyId.toString('base64url'),
        e_skey_val: Buffer.from(creds.signedPreKey.keyPair.public).toString('base64url'),
        e_skey_sig: Buffer.from(creds.signedPreKey.signature).toString('base64url'),
        fdid: randomUUID(),
        network_ratio_type: '1',
        expid: randomUUID(),
        simnum: '1',
        hasav: '2'
    };
    return params;
};
const requestExist = async (params) => {
    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const res = await fetch(`${REGISTRATION_BASE_URL}/exist?${qs}`, {
        headers: { 'User-Agent': REGISTRATION_USER_AGENT }
    });
    const body = (await res.json().catch(() => ({})));
    return { ok: res.ok, body };
};
const requestAppealStatus = async (appealToken, accessToken) => {
    try {
        const res = await fetch(APPEAL_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'User-Agent': REGISTRATION_USER_AGENT,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                variables: JSON.stringify({ app_id: 'dev.app.id', request_token: appealToken }),
                access_token: accessToken,
                doc_id: APPEAL_STATUS_DOC_ID,
                lang: 'en_GB'
            })
        });
        const data = await res.json().catch(() => ({}));
        return data?.data?.whatsapp_support_ban_appeal_status || null;
    }
    catch {
        return null;
    }
};
/**
 * Check whether a WhatsApp number is active, banned, blocked or rate limited.
 * Uses throwaway credentials only — nothing about the caller is registered.
 */
export const checkStatusWA = async (phoneNumber, options = {}) => {
    if (!phoneNumber) {
        throw new Error('checkStatusWA: please provide a phone number');
    }
    let num = String(phoneNumber).trim();
    if (num.includes('@')) {
        num = num.slice(0, num.indexOf('@'));
    }
    if (num.includes(':')) {
        num = num.slice(0, num.indexOf(':'));
    }
    const digits = num.replace(/\D/g, '');
    const number = `+${digits}`;
    const { countryCode, nationalNumber } = parsePhoneNumberParts(digits);
    const build = (status, isBanned, isNeedOfficialWa, banInfo = null) => ({ number, status, isBanned, isNeedOfficialWa, banInfo });
    let ok = false;
    let body = {};
    try {
        ;
        ({ ok, body } = await requestExist(buildExistParams(initAuthCreds(), countryCode, nationalNumber)));
    }
    catch {
        return build('error', false, false);
    }
    if (body.appeal_token) {
        const appeal = options.appealAccessToken
            ? await requestAppealStatus(body.appeal_token, options.appealAccessToken)
            : null;
        const appealStatus = appeal?.status || null;
        const banType = appealStatus === 'BANNED' ? 'permanent' : 'temporary';
        return build('banned', true, false, {
            banType,
            violationType: body.violation_type ?? null,
            canAppeal: banType !== 'permanent',
            appealToken: body.appeal_token,
            banTime: appeal?.ban_time ?? null,
            banDate: appeal?.ban_time ? new Date(appeal.ban_time * 1000).toISOString() : null,
            appealStatus,
            appealCreatedAt: appeal?.appeal_creation_time
                ? new Date(appeal.appeal_creation_time * 1000).toISOString()
                : null
        });
    }
    if (body.custom_block_screen) {
        return build('blocked', false, true);
    }
    if (body.reason === 'temporarily_unavailable') {
        return build('rate_limited', false, false);
    }
    if ((ok && (body.status === 'ok' || body.status === 'sent')) || body.reason === 'incorrect') {
        return build('active', false, false);
    }
    return build('error', false, false);
};
//# sourceMappingURL=check-status.js.map
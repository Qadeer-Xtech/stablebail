import { Boom } from '@hapi/boom';
import { createHash } from 'crypto';
import { proto } from '../../WAProto/index.js';
import { KEY_BUNDLE_TYPE, WA_ADV_ACCOUNT_SIG_PREFIX, WA_ADV_DEVICE_SIG_PREFIX, WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX } from '../Defaults/index.js';
import { getBinaryNodeChild, jidDecode, S_WHATSAPP_NET } from '../WABinary/index.js';
import { Curve, hmacSign } from './crypto.js';
import { encodeBigEndian } from './generics.js';
import { createSignalIdentity } from './signal.js';
const getUserAgent = (config) => {
    // Hybrid (upstream Baileys values + Android device): the server
    // delivers view-once media only to a device it recognises as mobile,
    // so device must be 'Android' for .vv — but osVersion/osBuildNumber
    // stay generic '0.1' (upstream values) so the pairing handshake does
    // not fail with a 516 stream error (real Android versions break it).
    const isAndroid = config.browser[1].toLocaleLowerCase().includes('android');
    // Every non-Android tuple identifies as a Mac (platform MACOS,
    // device 'Mac', real OS version/build): since WhatsApp's November
    // 2026 update the server rejects Platform.WEB companions, so a
    // Windows/Ubuntu tuple keeping WEB/'Desktop' can no longer pair.
    // The Android branch above deliberately keeps our own values —
    // they are the live-proven view-once combination.
    return {
        appVersion: {
            primary: config.version[0],
            secondary: config.version[1],
            tertiary: config.version[2]
        },
        platform: isAndroid
            ? proto.ClientPayload.UserAgent.Platform.ANDROID
            : proto.ClientPayload.UserAgent.Platform.MACOS,
        releaseChannel: proto.ClientPayload.UserAgent.ReleaseChannel.RELEASE,
        osVersion: isAndroid ? '0.1' : '14.4.1',
        device: isAndroid ? 'Android' : 'Mac',
        osBuildNumber: isAndroid ? '0.1' : '23E224',
        localeLanguageIso6391: 'en',
        mnc: '000',
        mcc: '000',
        localeCountryIso31661Alpha2: config.countryCode
    };
};
const PLATFORM_MAP = {
    'Mac OS': proto.ClientPayload.WebInfo.WebSubPlatform.DARWIN,
    Windows: proto.ClientPayload.WebInfo.WebSubPlatform.WIN_HYBRID // stablebail 1.0.4 (official PR #2741): WIN32 retire ho gaya — server 428 se handshake band kar deta hai
};
const getWebInfo = (config) => {
    let webSubPlatform = proto.ClientPayload.WebInfo.WebSubPlatform.WEB_BROWSER;
    if (config.syncFullHistory &&
        PLATFORM_MAP[config.browser[0]] &&
        config.browser[1] === 'Desktop') {
        webSubPlatform = PLATFORM_MAP[config.browser[0]];
    }
    return { webSubPlatform };
};
const getClientPayload = (config) => {
    const payload = {
        connectType: proto.ClientPayload.ConnectType.WIFI_UNKNOWN,
        connectReason: proto.ClientPayload.ConnectReason.USER_ACTIVATED,
        userAgent: getUserAgent(config)
    };
    if (!config.browser[1].toLocaleLowerCase().includes('android')) {
        payload.webInfo = getWebInfo(config);
    }
    if (config.pushName) {
        payload.pushName = config.pushName;
    }
    return payload;
};
export const generateLoginNode = (userJid, config) => {
    const { user, device } = jidDecode(userJid);
    const payload = {
        ...getClientPayload(config),
        passive: true,
        pull: true,
        username: +user,
        device: device,
        // TODO: investigate (hard set as false atm)
        lidDbMigrated: false
    };
    return proto.ClientPayload.fromObject(payload);
};
const getPlatformType = (platform) => {
    const platformType = platform.toUpperCase();
    if (platformType === 'ANDROID') {
        return proto.DeviceProps.PlatformType.ANDROID_PHONE;
    }
    return (proto.DeviceProps.PlatformType[platformType] ||
        proto.DeviceProps.PlatformType.CHROME);
};
export const generateRegistrationNode = ({ registrationId, signedPreKey, signedIdentityKey }, config) => {
    // the app version needs to be md5 hashed
    // and passed in
    const appVersionBuf = createHash('md5')
        .update(config.version.join('.')) // join as string
        .digest();
    const companion = {
        os: config.browser[0],
        platformType: getPlatformType(config.browser[1]),
        requireFullSync: config.syncFullHistory,
        historySyncConfig: {
            storageQuotaMb: 10240,
            inlineInitialPayloadInE2EeMsg: true,
            recentSyncDaysLimit: undefined,
            supportCallLogHistory: false,
            supportBotUserAgentChatHistory: true,
            supportCagReactionsAndPolls: true,
            supportBizHostedMsg: true,
            supportRecentSyncChunkMessageCountTuning: true,
            supportHostedGroupMsg: true,
            supportFbidBotChatHistory: true,
            supportAddOnHistorySyncMigration: undefined,
            supportMessageAssociation: true,
            supportGroupHistory: false,
            onDemandReady: undefined,
            supportGuestChat: undefined
        },
        version: {
            primary: 10,
            secondary: 15,
            tertiary: 7
        }
    };
    const companionProto = proto.DeviceProps.encode(companion).finish();
    const registerPayload = {
        ...getClientPayload(config),
        passive: false,
        pull: false,
        devicePairingData: {
            buildHash: appVersionBuf,
            deviceProps: companionProto,
            eRegid: encodeBigEndian(registrationId),
            eKeytype: KEY_BUNDLE_TYPE,
            eIdent: signedIdentityKey.public,
            eSkeyId: encodeBigEndian(signedPreKey.keyId, 3),
            eSkeyVal: signedPreKey.keyPair.public,
            eSkeySig: signedPreKey.signature
        }
    };
    return proto.ClientPayload.fromObject(registerPayload);
};
export const configureSuccessfulPairing = (stanza, { advSecretKey, signedIdentityKey, signalIdentities }) => {
    const msgId = stanza.attrs.id;
    const pairSuccessNode = getBinaryNodeChild(stanza, 'pair-success');
    const deviceIdentityNode = getBinaryNodeChild(pairSuccessNode, 'device-identity');
    const platformNode = getBinaryNodeChild(pairSuccessNode, 'platform');
    const deviceNode = getBinaryNodeChild(pairSuccessNode, 'device');
    const businessNode = getBinaryNodeChild(pairSuccessNode, 'biz');
    if (!deviceIdentityNode || !deviceNode) {
        throw new Boom('Missing device-identity or device in pair success node', { data: stanza });
    }
    const bizName = businessNode?.attrs.name;
    const jid = deviceNode.attrs.jid;
    const lid = deviceNode.attrs.lid;
    const { details, hmac, accountType } = proto.ADVSignedDeviceIdentityHMAC.decode(deviceIdentityNode.content);
    let hmacPrefix = Buffer.from([]);
    if (accountType !== undefined && accountType === proto.ADVEncryptionType.HOSTED) {
        hmacPrefix = WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX;
    }
    const advSign = hmacSign(Buffer.concat([hmacPrefix, details]), Buffer.from(advSecretKey, 'base64'));
    if (Buffer.compare(hmac, advSign) !== 0) {
        throw new Boom('Invalid account signature');
    }
    const account = proto.ADVSignedDeviceIdentity.decode(details);
    const { accountSignatureKey, accountSignature, details: deviceDetails } = account;
    const deviceIdentity = proto.ADVDeviceIdentity.decode(deviceDetails);
    const accountSignaturePrefix = deviceIdentity.deviceType === proto.ADVEncryptionType.HOSTED
        ? WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX
        : WA_ADV_ACCOUNT_SIG_PREFIX;
    const accountMsg = Buffer.concat([accountSignaturePrefix, deviceDetails, signedIdentityKey.public]);
    if (!Curve.verify(accountSignatureKey, accountMsg, accountSignature)) {
        throw new Boom('Failed to verify account signature');
    }
    const deviceMsg = Buffer.concat([
        WA_ADV_DEVICE_SIG_PREFIX,
        deviceDetails,
        signedIdentityKey.public,
        accountSignatureKey
    ]);
    account.deviceSignature = Curve.sign(signedIdentityKey.private, deviceMsg);
    const identity = createSignalIdentity(lid, accountSignatureKey);
    const accountEnc = encodeSignedDeviceIdentity(account, false);
    const reply = {
        tag: 'iq',
        attrs: {
            to: S_WHATSAPP_NET,
            type: 'result',
            id: msgId
        },
        content: [
            {
                tag: 'pair-device-sign',
                attrs: {},
                content: [
                    {
                        tag: 'device-identity',
                        attrs: { 'key-index': deviceIdentity.keyIndex.toString() },
                        content: accountEnc
                    }
                ]
            }
        ]
    };
    const authUpdate = {
        account,
        me: { id: jid, name: bizName, lid },
        signalIdentities: [...(signalIdentities || []), identity],
        platform: platformNode?.attrs.name,
        registered: true
    };
    return {
        creds: authUpdate,
        reply
    };
};
export const encodeSignedDeviceIdentity = (account, includeSignatureKey) => {
    account = { ...account };
    // set to null if we are not to include the signature key
    // or if we are including the signature key but it is empty
    if (!includeSignatureKey || !account.accountSignatureKey?.length) {
        account.accountSignatureKey = null;
    }
    return proto.ADVSignedDeviceIdentity.encode(account).finish();
};
//# sourceMappingURL=validate-connection.js.map
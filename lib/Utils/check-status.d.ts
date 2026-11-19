export type WAStatusKind = 'active' | 'banned' | 'blocked' | 'rate_limited' | 'error';
export interface WABanInfo {
    /** 'permanent' when the appeal status is BANNED, otherwise 'temporary' */
    banType: 'permanent' | 'temporary';
    violationType: number | string | null;
    canAppeal: boolean;
    appealToken: string;
    /** unix seconds, when the appeal endpoint reported it */
    banTime: number | null;
    banDate: string | null;
    appealStatus: string | null;
    appealCreatedAt: string | null;
}
export interface WAStatusResult {
    /** normalized number, international format with leading '+' */
    number: string;
    status: WAStatusKind;
    isBanned: boolean;
    /** true when WhatsApp demands the official app for this number */
    isNeedOfficialWa: boolean;
    banInfo: WABanInfo | null;
}
export interface CheckStatusOptions {
    /**
     * Access token for the ban-appeal GraphQL endpoint (the token the
     * official app ships with). Only used to enrich a "banned" result with
     * ban details; without it, banInfo still reports type/appeal basics
     * taken from the registration response itself.
     */
    appealAccessToken?: string;
}
/** Split international digits into { countryCode, nationalNumber } by longest prefix match. */
export declare const parsePhoneNumberParts: (digits: string) => {
    countryCode: string;
    nationalNumber: string;
};
/**
 * Check whether a WhatsApp number is active, banned, blocked or rate limited.
 * Uses throwaway credentials only — nothing about the caller is registered.
 */
export declare const checkStatusWA: (phoneNumber: string, options?: CheckStatusOptions) => Promise<WAStatusResult>;
//# sourceMappingURL=check-status.d.ts.map
# Changelog — @qadeer-xtech/stablebail

Based on **@whiskeysockets/baileys 7.0.0-rc14**. Only the changes made
on top of the official release are listed here.

## 1.0.10
- Test infrastructure: the repository now ships the jest
  configuration for the included unit test suite - `npm test`
  runs 28 suites / 407 tests, all passing (identical result on
  the pristine upstream baseline), and CI runs the unit tests
  on every push.
- README: the source-verification claim now states precisely
  what is byte-identical (the compiled JavaScript), and the
  switching example pin was updated.
- No library code changes in this release.

## 1.0.9
- Fix: onWhatsApp LID lookups now return the `lid` field. The
  internal PN-to-LID map key was malformed (`user@@s.whatsapp.net`)
  since 1.0.4, so the lookup never matched and `lid` was silently
  never attached. Found during the src/ source audit; proven with
  a runtime check against the shipped code before fixing.
- Type declarations healed to match the shipped JS surface
  (newsletter and status-mention methods, `nctSalt`,
  `thumbnail_info`) - these come from the verified TypeScript
  source in the repository (src/), which compiles byte-identically
  to the shipped library.
- README: recommended bot pin updated to 1.0.9.

## 1.0.8
- README: the licence section now describes the dual licence
  correctly, and dependency-transparency links were added.
- The libsignal and whatsapp-rust-bridge republishes now have
  public repositories whose DIFF.md files document that their
  code is byte-identical to upstream.
- First release published from the GitHub Actions workflow using
  npm trusted publishing (OIDC), with provenance attestation.
- No library code changes in this release.

## 1.0.7
- Public GitHub repository: https://github.com/Qadeer-Xtech/stablebail
  (package.json now carries repository / homepage / bugs links).
- NOTICE file is now included in the published package, as the
  LICENSE terms require.
- CHANGELOG.md and SECURITY.md added.
- Backports of upstream fixes that are STILL UNMERGED upstream
  (from the 1.0.7 deep analysis of WhiskeySockets/Baileys):
  * Ack top-level <status> stanzas - stops the server ending the
    stream (~50 min in) over a missing status ack
    (issue #2858, PR #2883).
  * Pairing-code flow: only process the primary_hello
    companion-reg notification, correct pairing nonce, creds
    marked registered on pairing, registration re-entered while
    a pairing code is pending (issue #2512, PR #2872).
  * Atomic multi-file auth-state writes (temp file + rename) -
    a crash mid-write can no longer corrupt creds.json (PR #2855).
  * Newsletter media: server_transcode for video/gif/ptv uploads,
    mediaUrl falls back to direct_path, server thumbnail fields
    are kept, newsletter messages no longer carry a regular
    media url (issue #2199 cluster, PR #2434 - completes 1.0.2).
  * Retry resend: a device-specific 1:1 retry is no longer
    encrypted twice; the session is asserted before encrypting
    (PR #2839).
- The media-reupload 403/404/410 fixes (issues #2767 / #2750)
  were already backported in 1.0.3 and are unchanged.

## 1.0.6
- All direct dependencies exact-pinned (reproducible installs);
  sharp stays a peer dependency (>=0.33.0 <1.0.0, optional).
- Dual licence done the proper way: upstream MIT text verbatim plus
  Team Qadeer terms in LICENSE, with a NOTICE file. No hidden
  checkers of any kind.
- README: "Recommended Settings for Bot Projects" section.

## 1.0.5
- Small QADEER banner printed once when a connection opens
  (opt out with `banner: false` in the socket config).
- New API: `sendStatusMention(jidList, content, options?)`.
- cstoken / timelock completion (computeCsToken HMAC-SHA256,
  NCT salt plumbing).

## 1.0.4
- Pairing/connect fixes: WIN_HYBRID platform map fix (upstream
  PR #2741); WhatsApp Web version pin updated to [2, 3000, 1048663002].
- `onWhatsApp` LID resolution fix (upstream issue #1522).

## 1.0.3
- Stream/media fixes: downloadEncryptedContent error forwarding
  (#2750); reupload Boom statusCode (#2767); HTTP 403 + expired-URL
  media reupload (PR #2835); getMediaRetryKey (PR #2834).
  Stream path tested up to 2 GiB.

## 1.0.2
- Channel (newsletter) fixes across the 24 newsletter methods.

## 1.0.1
- Dependencies published under the project's own scope:
  @qadeer-xtech/libsignal, @qadeer-xtech/eslint-config and
  @qadeer-xtech/whatsapp-rust-bridge (faithful copies of upstream).

## 1.0.0
- First release: faithful repack of @whiskeysockets/baileys
  7.0.0-rc14 under the @qadeer-xtech/stablebail name.

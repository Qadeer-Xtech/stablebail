# Roadmap — @qadeer-xtech/stablebail

## Standing rules
- Track upstream @whiskeysockets/baileys: every upstream release is
  reviewed and its fixes merged within 7 days.
- The WhatsApp Web version pin is reviewed at least once a month.
- Fixes that upstream has not merged yet are backported after a
  code-level review, and listed in CHANGELOG.md per version.

## Next (1.0.8 candidates)
- Newsletter parsers: newsletterCreate response shape (#2313) and
  newsletterFetchMessages timeouts (#2555) — original fixes.
- Status sends to LID recipients (upstream PR #2841 review).
- Encrypted message-edit decryption (upstream PR #2743 review).
- More runnable examples (groups, polls, media).

## Publishing
- npm provenance (signed builds from GitHub Actions) is being set
  up; it needs a one-time trusted-publisher configuration on the
  npm package page. The workflow already lives in
  .github/workflows/publish.yml.

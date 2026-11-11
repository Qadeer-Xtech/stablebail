# Release checklist

Har release par yehi steps — taake koi fix dobara na tootay.

- [ ] Saare fixes commit ho gaye (working tree saaf)
- [ ] `npm run build` — phir `git add -A lib` aur poori lib commit
      (maps samet; lib ko haath se edit nahi karna)
- [ ] `npm test` — 28 suites / 407+ tests pass
- [ ] package.json version bump (SemVer: fix = patch, feature = minor)
- [ ] README ke version pins current version par (Recommended
      Settings wala pin; Switching example `@latest` par hai)
- [ ] Fork aliases (libsignal / whatsapp-rust-bridge) current hain
- [ ] CHANGELOG.md mein is version ki entry
- [ ] git tag: v<version>
- [ ] Publish sirf GitHub Actions (publish.yml) se — provenance ke liye
- [ ] Publish ke baad verify:
  - `npm view @qadeer-xtech/stablebail version`
  - `npm view @qadeer-xtech/stablebail dist.attestations`
  - tarball mein maps: `tar -tzf <tgz> | grep -c '\.map$'` = 198

Raftar ka usool: **fix jama karo, haftay mein ek release.**
Roz ki releases users ko "unstable" ka signal deti hain.

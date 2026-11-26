# Contributing to AESS

Thanks for helping! Contributions that help most:

- **Print reports.** Did the fit test click, rattle or jam? On what printer and material? Open an issue.
- **New part types.** Dividers, half-grid cups, label clips, stack links. See [docs/ROADMAP.md](docs/ROADMAP.md).
- **Generator improvements:** usability, accessibility and performance.

## Ground rules
1. **The interface is sacred.** Anything in §1–§3 of [docs/STANDARD.md](docs/STANDARD.md) is what makes parts interlock. A change there must be argued in an issue first, and it is a breaking (major) version.
2. **CAD and web stay in sync.** If you change geometry in `web/aess-core.js`, update `cad/aess_master.sc` to match and re-measure the fixture volumes in `test/core.test.js`, or explain in the pull request why that isn't needed.
3. **Printable without supports.** Every overhang must be ≤ 45° when the part sits foot-down.

## Setup
```bash
npm ci
npm run dev        # http://localhost:8080
npm run check      # must pass before a PR
npm run test:e2e   # browser smoke test
```

## Adding a part type
1. Add the type to `TYPES` in `web/aess-core.js` and its geometry to `buildPart`.
2. Add test cases to `test/core.test.js`: a closed shell, the expected size and a volume range.
3. Add a card for it in `web/index.html`; the controls pick it up automatically.
4. Document it in `docs/STANDARD.md` (naming) and `CHANGELOG.md`.

## Commits and pull requests
- Keep each pull request focused, and fill in the template's checklist.
- Commit messages: imperative mood and short, e.g. `Add half-grid cup part`.

By contributing, you agree that your work is released under the [MIT License](LICENSE) and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).

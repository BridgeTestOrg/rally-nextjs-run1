# Epic Implementer testing notes — rally-nextjs-run1

Test project for the Bridge MCP. Source project: `bridge-api` (sibling checkout at
`../../../bridge-api`, inspected at `917b6fe12`). These notes record setup findings
found while preparing this repo for an Epic Implementer run.

---

## Finding 1 — `unit_testing_stack` left unset on a repo with a working unit-test suite

**Date found:** 2026-11-18
**Severity:** Medium — silent config gap. Nothing failed; automation that reads the
stack (e.g. `/run-tests`, planners, Epic Implementer) simply had no value.

### What we observed

After `/install-bridge` completed, Bridge config showed:

| Field | Value after install |
|---|---|
| `unit_testing_stack` | `null` |
| `e2e_testing_stack` | `null` |
| `unit_testing_instructions` | generic catalog default (`is_catalog_default: true`) |
| `e2e_testing_instructions` | generic catalog default, despite the repo having **no** e2e suite |
| `epic_implementer_test_commands` | `null` |

Yet the repo had unambiguous unit-test evidence at install time:

- `package.json`: `"test": "vitest run"`, devDeps `vitest`, `@testing-library/react`, `jsdom`
- `vitest.config.mts` (jsdom environment)
- `__tests__/page.test.tsx` (passing)
- `.github/workflows/ci.yml` runs `npm test`

### What actually happened (correcting the first hypothesis)

The first guess was "we used generic settings during `/learn-repository` and didn't set the
pieces we could." That is not what happened — **`/learn-repository` was never run on this
project.** The gap comes from `/install-bridge`'s greenfield path:

1. `/install-bridge` classified the repo as **Greenfield** (untouched create-next-app page,
   one placeholder test, one commit). That classification is reasonable.
2. It handed off to the `greenfield-setup` recipe. The human chose **Use defaults** rather than
   the interview.
3. On the defaults path the interview task skips Steps 2–6, which is where the stacks are
   collected:
   - `mcp_server/instructions/greenfield-interview.md:42` — "When the setup path is `defaults`,
     skip Steps 2 through 6 entirely…"
   - `mcp_server/instructions/greenfield-interview.md:73` — stacks are collected only inside
     that skipped step ("collect each only when it applies").
4. The final apply then only allows stacks that came from the interview:
   - `mcp_server/instructions/greenfield-apply-and-report.md:53-54` — "Unit and end-to-end test
     stacks — include each only when the interview gave a definite answer."
5. So the defaults path **can never** set either stack, even with unambiguous local evidence.

### The asymmetry that makes this a bug, not a choice

The same apply instruction lets `working_in` be resolved from **clear local evidence**
(`greenfield-apply-and-report.md:44-45`: "resolved through the authoritative configuration,
clear local evidence, or the interview"). The test stacks get no such evidence path. In this
run `working_in` was correctly set to `JavaScript/TypeScript` from `package.json`, while
`unit_testing_stack` was dropped despite equally clear evidence in the same file.

The established (non-greenfield) install path *does* derive testing stacks from test config
and dependencies (install-bridge Stage 3: "testing stacks from test config and
dependencies"). Only the greenfield path loses them.

Related: the defaults path also seeds generic `e2e_testing_instructions` on a repo with no
e2e framework, which could push agents toward writing e2e tests with no runner configured.

### Suggested fix (for bridge-api)

- In `greenfield-apply-and-report.md`, allow `unit_testing_stack` / `e2e_testing_stack` from
  **clear local evidence**, mirroring `working_in` — e.g. a single test runner in
  `package.json` scripts/devDeps plus its config file. Keep the "ambiguous → omit" rule
  (two runners = omit).
- Or: collect the stacks in the interview task's Step 3 on **both** paths, the way Step 7
  (version control) already runs on both paths.
- Consider not seeding `e2e_testing_instructions` when no e2e framework is detected, or
  seeding it with a note that no e2e runner is configured yet.
- Add a regression case: greenfield + defaults + Vitest scaffold → `unit_testing_stack` set.

### What we did in this repo

- Set `unit_testing_stack` = `Vitest + React Testing Library` (manual `config_field` update).
- Replaced the generic `unit_testing_instructions` with the project-specific version in
  `unit_testing_instructions.md` (this directory).

---

## Finding 2 — Testing Library cleanup never ran (latent test-isolation bug in the starter)

**Date found:** 2026-11-18

The create-next-app + Vitest starter (`vitest.config.mts` from the Next.js 16 Vitest guide)
does not enable Vitest globals. Testing Library's automatic `cleanup()` only registers when a
global `afterEach` exists, so renders accumulated across tests in the same file. Verified with
two tests that each rendered `<Page />`: the second saw 2 `h1` headings and failed.

The single starter test masked it. An epic writing multiple component tests per file would have
hit confusing "found multiple elements" failures.

Fix: `vitest.setup.ts` calls `cleanup()` in `afterEach`, wired via `setupFiles`. Re-verified
(2/2 pass). Worth flagging upstream as a Bridge default-standards gap: generic unit-test
instructions can't catch a harness-level isolation bug like this.

## Finding 3 — Fixed e2e port would collide across parallel Epic Implementer worktrees

The first `playwright.config.ts` used port 3000 with `reuseExistingServer` locally. Parallel
epic children in separate worktrees would either fail on a busy port or — worse — reuse
another worktree's server and test the wrong code. Fix: port derived from a hash of the
checkout path (3100–3899, override `E2E_PORT`), and server reuse is opt-in
(`E2E_REUSE_SERVER=1`).

## Finding 4 — Epic Implementer setup blocks on *any* missing learned field, including code review instructions

**Date found:** 2026-11-18
**Severity:** Medium — setup dead-ends on a field that should be advisory.

`/install-epic-implementer` (MCP 0.2.77) stopped at its first read-only assessment with
`repository_not_learned` and `missing_learned_fields: ["design_principles", "review_instructions"]`.
Nothing was written. The only offered paths were `/learn-repository` (the whole set) or
`/teach-bridge` (one at a time).

Context: this repo took the greenfield **defaults** path in `/install-bridge`, which seeded seven
catalog defaults and skipped `review_instructions` (no catalog entry) and `design_principles`.
So the defaults path produces a repository that `/install-epic-implementer` then refuses — the
two setup commands disagree about what "set up" means.

### Which fields should block

- **`design_principles` — should block (for a repo with UI).** Epic children that build UI
  write it directly from this field; with no design direction the implementer improvises a visual
  language, which is a real quality risk and hard to undo across parallel children.
- **`review_instructions` — should not block.** The reviewer can run with generic review
  behavior, and `check_code_correctness` already gates whether PRs are held to standards. A
  missing review field degrades review quality; it does not make implementation unsafe. It
  belongs in the advisory list ("Also worth doing"), not in `repository_not_learned`.

### Suggested fix (for bridge-api)

- Split `missing_learned_fields` into blocking and advisory sets. Blocking: fields the
  implementer writes code from (`design_principles` when the repo has UI, architecture and
  testing instructions). Advisory: `review_instructions`, `documentation_instructions`.
- Make the greenfield defaults path and this gate agree: either seed a catalog default for
  `review_instructions` / `design_principles`, or have `/install-bridge`'s defaults report
  name them as still needed before an epic run.
- Consider deriving `design_principles` from attached comps/style guides when an epic carries
  them (here the epic's `styles.md` + comps were sufficient to write them by hand).

### What we did in this repo

- Wrote `design_principles` from the RNX-1 epic, its spec, `styles.md` and the full-page comp,
  kept project-level rather than ticket-specific (`design_principles.md`, this directory).
- `review_instructions`: next.

## Finding 5 — Changing one worker setting means re-running the whole Epic Implementer setup

**Date found:** 2026-11-18
**Severity:** Medium — friction, and it pushes owners toward hand-editing local records.

To let workers use the Playwright MCP (needed for UI checks against the epic server), the only
sanctioned path is to re-run `/install-epic-implementer`: a full assessment, a full proposal,
and a full approval, re-stating every other answer. The grant lives in
`~/.config/bridge/mcp-grants/<repo>.json` (`mcp_server/src/mcp-grant.ts`), and only setup
writes it. No install is needed — Playwright is a built-in preset (pinned `@playwright/mcp`,
launched with `npx -y --headless --isolated`, `mcp_server/src/mcp-presets.ts`) — so this is
purely a settings change behind the full setup loop.

There is precedent for a narrow path: `install epic-implementer --epic-server` re-asks only the
epic-server question (`install-bridge-conductor.ts:948`). The worker MCP grant has no equivalent.

### Related: the recommendation ignored what this repo already declared

Setup recommended **no** extra worker servers ("each extra server is a deliberate grant") even
though Bridge config already had `e2e_testing_stack = Playwright`, the epic plainly builds UI,
and the same setup recommended a **local epic server** for UI checks. Per
`mcp_server/src/conductor/ui-readiness.ts`, UI verification needs *both* a browser MCP grant and
an epic-server mode, so the recommended combination (local server + no browser) can never verify
UI. The recommendation should be consistent with itself.

### Suggested fix (for bridge-api)

- Add a single-setting path, mirroring `--epic-server`: e.g.
  `install epic-implementer --worker-mcp playwright` (or a `/teach-bridge`-style verb) that
  re-asks only the grant question, shows its consequence, and asks one approval.
- Generalize: every setup answer that has its own record (grant, epic server, epic-branch CI,
  dependency install, test commands) should be changeable on its own without restating the rest.
- When the epic-server recommendation is `local`/`sfcc_shared_active`, or `e2e_testing_stack`
  names Playwright, recommend the Playwright preset in the worker grant (or at minimum warn that
  the chosen combination leaves UI checks unverifiable).

---

## Change log — e2e setup (2026-11-18)

- Installed `@playwright/test@1.65.1` (exact pin) and the Chromium browser.
- Added `playwright.config.ts`: `testDir: ./e2e`, chromium only, `webServer` runs
  `npm run build && npm run start` (production build, per the Next.js 16 Playwright guide in
  `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`), retries 0,
  `forbidOnly` when `CI` is set, trace/screenshot on failure.
- Added `e2e/home.spec.ts` smoke test; `npm run test:e2e` script.
- `vitest.config.mts` now excludes `e2e/**` (Vitest's default include would otherwise pick up
  `*.spec.ts`).
- `.gitignore`: Playwright artifacts.
- Verified locally: `npm test` ✓, `npm run test:e2e` ✓, `npm run lint` ✓.
- Bridge config: `e2e_testing_stack` = `Playwright`; `e2e_testing_instructions` replaced with
  the project-specific version in `e2e_testing_instructions.md` (this directory).

## Bridge settings changed (2026-11-18)

- `unit_testing_stack` = `Vitest + React Testing Library`
- `e2e_testing_stack` = `Playwright`
- `unit_testing_instructions` → project-specific (`unit_testing_instructions.md`)
- `e2e_testing_instructions` → project-specific (`e2e_testing_instructions.md`)
- `design_principles` → project-specific (`design_principles.md`)
- Both testing instructions revised to agree with the RNX-2 harness: e2e defers to
  `playwright.config.ts` / `e2e/README.md` and the ticket, uses the fixtures import, the
  server-side weather stub and per-server databases (no fixed port, no in-browser mocking of
  server calls); unit tests are named after their module in a flat `__tests__/`, not mirrored.
- `epic_implementer_test_commands` = `["npm test", "npm run test:e2e", "npm run lint"]` — saved at
  generation 2, `trial_state: not_tried`, `commands_in_force: []`. Takes effect only after a
  clean-checkout trial passes. All three commands pass on a fresh clone of `main` at `54c4d35`.

## Open items before the epic run

- [x] Commit + push the Playwright/Vitest setup to `main` (`73b2973`, `54c4d35`).
- [ ] Confirm the test-command trial passes (`commands_in_force` populated).
- [x] `check_code_correctness` left `false` — owner's choice for this run; the standards still
      guide implementation, but the reviewer won't flag violations.
- [x] ~~CI runs Playwright~~ — decided against; the epic's local test gate covers it.
- [x] `unit_testing_instructions` tailored.

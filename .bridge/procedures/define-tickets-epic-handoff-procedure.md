# `/define-tickets` epic hand-off procedure

This procedure carries the epic-only parts of `/define-tickets` Stage 9. The command
reads it once per run, after it has frozen a split of three or more slices, and then
follows one section of it at each epic-only pointer in Stage 9. Do not run every
section right after loading it. Each section uses the working state the command
already holds: the frozen manifest, the exploration document, the drafting plan, and
the run mode. Sections that mention "the command" mean `/define-tickets`. Nothing in
this file changes the command-owned steps: the split rules, the `--max-children`
cap, the writer fan-out, the upload gate, Handling changes, creation, tracking, the
materials pass, and the Final Report all stay in the command.

## Step 2 — Epic gap check (frozen manifest)

**For an epic, check the frozen manifest before any writer runs.** This runs only for an epic, after the split is frozen and before drafting:

1. Write the frozen manifest as JSON to `{docs_dir}/epic-plans/{slug}/epic-manifest.json`, the same directory step 4 of this procedure uses for `epic-plan.dag.json`. It holds the arrays in the input field names `review-epic-coherence.md` defines. `manifest` is the complete, ordered child list (`id` as the 1-based position, `title`, `scope`, `size_band`, `depends_on`, `recommended_after`, `touched_files` from the design's file list — the files the child edits or creates — `read_files` for files it only reads, when known, and `owns_verifications`). `child_evidence` has one entry per child with its planned acceptance criteria: the ratified criteria text the child satisfies plus each of its `owns_verifications` obligations word for word. `non_child_owners`, when the epic has any, sits beside `manifest` and `child_evidence`.
2. Write the review input to `{docs_dir}/epic-plans/{slug}/epic-coherence-input.json`. `epic` carries the `slug`, the epic title, and the ratified acceptance criteria from the exploration doc, each with its `id`, its text, and its verification sentence. `design_text` is the doc's `## Goals & NFRs` section, verbatim, followed by its `## Proposed Design`; the reviewer checks the split against the NFRs as well as the criteria. `manifest`, `child_evidence`, and `non_child_owners` (when present) are copied unchanged from `epic-manifest.json`.
3. **Apply the recorded gap-check policy.** An attended run asks no gap-check question: Stage 6 already recorded `drafting_plan.gap_check_policy`, and this step executes it before any writer runs. It also asks no council question: the Stage 6 plan already decided that, and no further split-review question is needed.
   - **Epic, `run_if_epic`.** Run the procedure as described next, in `drafting` mode, attended.
   - **Epic, `skip`.** Run no reviewer. Write a skip record to `{docs_dir}/epic-plans/{slug}/epic-coherence.json`: `schema_version` `3`, verdict `not_checked`, `skipped_by_operator: true`, `rounds: []`, the three current digests computed from `epic-manifest.json`, an empty coverage map, and one override of kind `bypass` with reason `Operator chose to skip the gap check` and `accepted_by: "operator"`. Then go on to drafting.
   - **Siblings.** Run no epic reviewer, write no coherence record, show no extra outline line, and ask no extra prompt. The conditional policy stays recorded in the plan.

   Follow `review-epic-coherence.md` in `drafting` mode, attended, with that input path and `{docs_dir}/epic-plans/{slug}/` as the output directory. Pass `council_preapproval` with `value` set to the legacy `council_choice` recorded from the drafting plan (`approved` for `before` and `after`, `declined` for `none`) and `source` set to the exact string `define-tickets council answer`, so the procedure asks no council question of its own. Also pass `auto_amend: true`: the procedure fixes gaps by amending the manifest within its existing round and confirmation bounds, with no question, and any foundation gap still left after the bound goes to the upload gate with an agent-drafted reason instead of a question. It computes `manifest_sha256`, `child_evidence_sha256`, and `non_child_owners_sha256`, applies its risk-scaled round limit, and writes `epic-coherence.json` and `epic-coherence.md` there. Read the coherence procedure through the command-owned lookup in `/define-tickets` Stage 9 (the paragraph headed "Coherence procedure lookup"), which keeps the installed, legacy `docs/install/`, and checkout locations in order, the unreadable-file failure rule, and the repair guidance. Never improvise a substitute review.

**Only under --auto:** the coherence run is unattended. Execute the recommended plan recorded in Stage 6, which always includes the gap check for an epic. Pass the literal `auto_approve_external = "true"` and no `council_preapproval`, never write a skip record, and use the procedure's bounded amend-and-recheck behavior instead of the operator-directed fix loop below. It clears only with no foundation blockers and every ticket-local blocker carried; it halts as `epic_coherence` with verdict `blocked` when foundation blockers remain after the bound or non-convergence. Clearance is independent: `independent: false` fails even on `pass`, `not_checked` fails, and an attended-only bypass or accept cannot clear an auto run. Halt before any writer or `create_ticket` on `blocked`, `not_checked`, `independent: false`, an unresolved required council, or any other non-clearing record. Name the specific cause in prose and halt as `epic_coherence` with the record path and a `coherence_verdict` of only `blocked` or `not_checked`. If the procedure is unavailable or cannot be invoked, halt as `stage_failed` naming Stage 9; never fabricate a coherence result. Siblings keep their no-coherence path. For an epic, skip the pending-acceptance list, the upload gate, and its reply parsing in the command's Stage 9 step 3: drafting and creation proceed only once the record clears, with no prompt. For siblings, skip the upload gate and its reply parsing in the command's Stage 9 step 3: creation proceeds with no prompt once every auto gate and draft-completeness requirement has cleared.

**Resolve the result at the gate.** Every remaining **foundation** blocking finding (a gap in how the work is split) must be fixed or accepted before creation. Ticket-local blockers are carried into their child ticket, shown as "a note added to ticket N", and do not require acceptance at this epic gate. There is no separate fix-or-accept question: the upload gate below is the one surface that resolves foundation findings (the upload gate in the command's Stage 9 step 3). Use the plain words in "What the user sees" in `review-epic-coherence.md` for everything the user reads; the record keeps its technical values.
- **Fixed automatically.** Under `auto_amend: true`, the procedure amends the manifest between rounds within its existing bounds, with no question. Each amendment re-freezes it: rewrite `epic-manifest.json` and the input before the next round.
- **Change how the tickets are split** (fix) — only when the user explicitly asks for it by replying "change something" at the command's upload gate. Amend the manifest (add or rescope a child, or reassign an obligation). That re-freezes it: rewrite `epic-manifest.json` and the input, re-run the check within the existing bounds, redraft the affected entries as described under Handling changes in the command's Stage 9 step 3, and return to the updated upload gate. The budget is one operator-directed fix plus one additional whole-manifest confirmation pass, counted across every coherence-check re-run in the same attended define-tickets run. A fix made after the procedure's last allowed round gets its one confirmation pass, so the record's last round still bears the final digests. Once the budget is spent, only accept or `blocked` remain.
- **Create anyway, and record the gap on the epic** (accept) — the default for every foundation gap still left after the bound. The reason is agent-drafted, non-empty, and shown on the upload gate. Record it in `epic-coherence.json` as an override of kind `accept` with the `finding_id`, the `reason`, `accepted_by`, and the `round`. When every remaining foundation blocking finding is accepted, the verdict is `accepted_with_gaps`.
- A finding that is declined, or left without a reason, keeps the verdict `blocked` and keeps creation blocked.
- **Couldn't check** (reviewer unavailable) — say "Couldn't check" and offer to try again or to create without it. Creating without it needs a reason the operator types, recorded as an override of kind `bypass`. The internal verdict stays `not_checked`. Never show or treat it as a pass. This exception stays outside the ordinary upload gate. It fails closed: retries are operator-initiated, and neither creation preflight clears it without the recorded typed bypass.

**Enforce ticket scope after amendments (attended only).** Re-check the implementation-ticket count against `ticket_scope` after every coherence amendment or operator-requested split change, before any writer or ticket creation. If the count differs, use the Stage 8 scope-change agreement and implications checkpoint before proceeding; rebuild and revalidate the frozen split and any affected coherence record, and regenerate any affected drafts. Count only children or ordinary tickets; show an epic parent as additional. The upload approval never substitutes for agreement to a changed count. This does not add an attended scope gate under `--auto`.

## Step 3 — Record check and full clearance

**Check the record before any writer.** For an epic, the coherence record is validated before drafting, but attended pre-writer validation is narrower than full clearance. Attended pre-writer validation checks frozen-entry identity, sizing, readable recognized records, all three current digests, last-round identity or the existing attended exceptions, finding scopes, child references, carry completeness, confirmation budgets, and required-council resolution. The single attended exception: the only uncleared items may be foundation gaps that are each listed individually under `Known gaps that will be recorded on the epic`. Keep each proposed acceptance in working state, bound to its finding id, its exact non-empty agent-drafted reason, its round, and the manifest and evidence identities. Do not persist it as an operator acceptance before approval. Under `--auto`, full clearance applies before any writer, exactly as below.

**Full clearance, before the first `create_ticket` call (and before any writer under `--auto`).** Refuse to create an epic unless all of these hold, with actual persisted acceptances for every remaining foundation blocker:
- `epic-coherence.json` exists in `{docs_dir}/epic-plans/{slug}/` and is readable;
- its `schema_version` is `1`, `2`, or `3`; legacy blocking findings are foundation findings. For version `3`, validate scope, child references, carry completeness, confirmation budget, and the foundation-only verdict before any writer call;
- its `manifest_sha256` matches the frozen manifest shown at the gate, its `child_evidence_sha256` matches the current child evidence, **and** its `non_child_owners_sha256` matches the current non-child owners, all computed from `epic-manifest.json` with the encoding `review-epic-coherence.md` specifies (an absent array hashes as an empty array; a version `1` record without the third digest matches only when there are no non-child owners);
- its `rounds` array is non-empty and its top-level digests equal its last round's digests. The only exception is an attended record with `amended_after_final_round: true`, a typed `bypass` override, and verdict `not_checked`, whose top-level digests still match the current input. A second exception is the attended skip record: `skipped_by_operator: true`, an empty `rounds` array, verdict `not_checked`, a `bypass` override with a non-empty reason, and top-level digests that match the current input;
- no required council is left `still_running`, `failed`, or `timed_out` unless an attended `accept` override with a typed reason names its `council_id`;
- its verdict is `pass`, including a version 3 record with carried ticket-local blockers, or `accepted_with_gaps` with every remaining foundation blocking finding accepted with a non-empty reason, or `not_checked` with a recorded override of kind `bypass` carrying a non-empty reason.

For a skip record, the parent writer's coverage map is derived from manifest ownership, and the parent's `## Epic coverage map` is built from the manifest's `owns_verifications` and `non_child_owners`, and says plainly that the gap check was skipped by the operator.

A council outcome of `declined_by_operator` is resolved and needs no `accept` override, whether it was declined at the pre-round-1 ask or through legacy `council_preapproval: declined`. A legacy `accept` override targeting `council: "declined_by_operator"` remains valid but is ignored for clearance.

The displayed reasons and override targets must stay unchanged between approval and creation. If either changed, show the gate again rather than treating the earlier reply as authorization. Unknown record fields are ignored and never authorize anything. A missing or unreadable record, an unrecognized schema version, a digest mismatch, top-level digests that differ from the last round's, an unresolved required council, `blocked`, or an un-bypassed `not_checked` stops here: report which one, and create nothing. This is the same rule as the epic coherence preflight in `render-ticket-manifest.md`, which holds its canonical wording; this command adds only the attended pre-writer timing exception above, and the canonical instruction is unchanged. This command does not route through that instruction, so the rule is stated here too.

## Step 3 — Epic outline items 1–3

These three lines come first in an epic's plan outline. The command's outline then
continues with its own items 4 through 9.

1. **Gap check** (epic only, first) — the outcome in plain words: `No gaps found` (or `No gaps found (N notes added to tickets)` when ticket-local findings are carried), `Accepted with known gaps`, `Needs your decision`, `Skipped, your choice`, or `Couldn't check`. When the initial council was declined, add the information line `Council: skipped, your choice`. That line is not a warning, not an unresolved item, and not something to accept.
2. **Independence and notes** (epic only) — when the record says `independent: false`, say: this check ran in my own session, not by a separate reviewer, so it's less independent. List each carried ticket-local finding as "a note added to ticket N" with a short summary. An attended operator may discuss or fix a carried finding.
3. **Who covers each requirement** (epic only) — one plain bullet per epic AC: the AC id, the owning child (or, for an owner-run owner, "owner-run" with the person or role and the step reference), then the obligation that proves it.

## Step 3 — Known gaps (epic only)

**Known gaps (epic only).** After the outline, list under `Known gaps that will be recorded on the epic` each foundation gap still left after the automatic fixes. For each, give a plain-language description of what is wrong and the non-empty, agent-drafted reason that would be recorded, so the operator reads it before approving. This is a list, not a question: there are no per-gap options. A "yes" at the upload question records them; "change something" lets the operator ask for a split change instead. A declined initial council is not a gap and is never an acceptance target. An unfinished required council (`still_running`, `failed`, or `timed_out`) is shown as its own unresolved item.

## Step 4 — Write the plan DAG

In local mode, retain every confirmed minted epic/child key in the manifest immediately and emit neither plan file while a required key is missing or creation is uncertain; use those real keys rather than `TBD-N` placeholders. After an epic's tickets are created, write the Epic Implementer's plan sidecar to `{docs_dir}/epic-plans/{slug}/epic-plan.dag.json`. You already hold everything it needs: the frozen manifest carries each child's `depends_on`, and Stage 8's design named the files each slice touches. Nothing downstream derives this from an epic key, so if you skip it the handoff dead-ends. The epic-body manifest uses the same child order and hard `depends_on` relationships as `epic-plan.dag.json`.

```json
{
  "plan_version": 1,
  "nodes": [
    {
      "ticket_key": "KEY-2",
      "status": "planned",
      "depends_on": [],
      "touched_files": ["src/example/service.py", "src/example/handler.py"]
    }
  ],
  "edges": []
}
```

One node per child, in manifest order, using the **real** keys just created — never a `TBD-N` placeholder, since the tickets already exist. `depends_on` carries the manifest's hard prerequisites only; leave `recommended_after` out, because soft sequencing is not a dependency and encoding it there serializes work that could run in parallel. `edges` may be `[]` when `depends_on` already expresses the graph. The graph must be acyclic and every `depends_on` entry must name a node in the file.

Populate `touched_files` on every node from the design's file list, as repository-relative POSIX paths — concrete files only, never a directory or a glob. It is what lets the Epic Implementer serialize two children that would otherwise collide, and it matters more the larger the slices are. An omitted list is accepted by the server as an explicit opt-out, so leaving it off does not fail — it silently turns plan-time overlap protection off. Use `[]` only when a ticket genuinely touches no repository files. Which overlaps get an ordering edge is decided by the server, not by you: on runs created from a repository with a confirmed gate profile, only children whose files both fall under one of the repository's must-order paths (for example a migrations directory, declared in the gate profile and confirmed by the owner) are ordered, and ordinary shared files run in parallel and are resolved at merge time. Do not add `depends_on` entries just because two children share an ordinary file.

Then write the plan's epic key beside it, at `{docs_dir}/epic-plans/{slug}/epic-plan.meta.json`, holding exactly:

```json
{"epic_key": "<EPIC-KEY>"}
```

Use the real epic key just created. This path runs no `finalize` step, so it writes the file itself. It is how `drive-epic` finds this epic's plan without being handed a path.

Include the files that are easy to forget, because those are the ones that actually collided: **anticipated tests, fixtures, golden files, guard allowlists, and policy files**, not only the production modules. Both known misses were exactly this class — two children shared `ticket_type_evaluator.py` *and its test*, and another pair shared golden files and a `save_repo_to_db` test — and in each case nobody predicted the shared file, so no ordering edge was synthesized and both PRs merged over each other. Paths are compared as exact strings after normalization, so name concrete files: a directory or a glob matches nothing.

**Save the plan to the Bridge server.** After `epic-plan.meta.json` is written, and after `epic-coherence.json` from the gap check, save the plan so anyone with access to the repository can run the epic with no local plan folder. Resolve the trusted launcher prefix once, quote each argument on its own, and run:

```bash
<launcher> epic-plan save --epic-key '<EPIC-KEY>' --plan-dir '{docs_dir}/epic-plans/{slug}' --json
```

It saves the DAG, the eligibility advisory, and the gap-check record together, and prints the server's `authored_version`. Saving an unchanged plan again reuses the stored version. The local files stay as a readable copy. A failed save is a **warning, not a failure**: the tickets already exist and stay created, so never report `create_failed` for it. Report the epic and the exact `retry_command` the command printed, and continue.

## Step 5 — Hand off once

Present these sections in order:

- **Plan/tickets saved** — confirm the epic, real child keys, and saved DAG/metadata. Name the server copy: `Plan saved on the Bridge server as authored version <N>`, or, when the save failed, `Plan NOT saved on the Bridge server` with the epic and the exact retry command. Saved work remains successful even when launch readiness is refused or unconfirmed, and even when the server save failed.
- **Readiness preview** — only when the concrete epic key, finalized child keys, `epic-plan.dag.json`, and `epic-plan.meta.json` exist and you recommend launch, use the Completion advisory section at the end of this procedure. Resolve the trusted multiword launcher prefix once, quote dynamic arguments independently, and run `drive-epic '<EPIC>' --dry-run --json` at most once with a 60-second command timeout/cancellation. Parse valid authoritative JSON regardless of exit status. Render selected target, returned reason/remedy, and any `availability_text` verbatim; retain conditional cold-start distinctions. State **ready at preview time**, refusal, or **readiness not confirmed**, never an execution guarantee. If the bounded seam or preview is unavailable, offer the same command for a later user-initiated retry and continue the saved-work report. No automatic rerun on later turns, no second readiness call, and no create/start/approve/provision/index/schedule action.
- **Launch next step** — point at exactly one launch, by host, conditional on the preview result. Ticket creation does not establish executor, policy, VCS, or indexing readiness. Missing keys, unresolved `TBD-N` entries, or unfinished artifacts receive neutral finalization guidance without probing a nonexistent epic. Ordinary ticket-definition and sibling/lone-ticket requests require no completion readiness call.

Preserve these canonical host routes:

- **Claude Code or Cursor:** `/drive-epic-run {EPIC-KEY}`
- **Codex or Copilot:** `npx -y @bridge_gpt/mcp-server drive-epic {EPIC-KEY}`

Both launch through `drive-epic`, and both find the plan through `epic-plan.meta.json`. **The one command both creates and drives the run:** `/drive-epic-run` previews the launch, asks for an explicit yes, creates the run through `drive-epic`, starts its executor, and then drives it. On Codex or Copilot, `drive-epic` creates the run and starts its executor, and the first-run steps are in `docs/install/epic-implementer-install.md` (write or refresh it with `npx -y @bridge_gpt/mcp-server install`).

With no target flag, `drive-epic` targets production and uses this repository's stored Bridge credential, so no `BAPI_BASE_URL` export or temporary notification terminal is needed when the authoritative preview confirms readiness. A fresh project may still have the returned unmet requirements; planning success does not remove them. For a local or other non-production target, `drive-epic --help-advanced` lists the owner options. A conflicting target, or a stored key approved for a different server, refuses before any authenticated request.

`drive-epic` defaults to the unattended posture. Escalations go to the account's email address; a `--policy-file` is needed only when the account has no email for escalations. Pass `--attended` to opt out of the unattended default. `drive-epic` reads Epic Implementer readiness and selects the runnable path itself. Do not name an underlying launch path, and never present a choice between two of them — two transition authorities on one epic is the failure this single entry point exists to remove. A sibling pair or a lone ticket gets no Epic Implementer handoff at all.

**Only under --auto:** render this handoff as a report line and never invoke it.

Every unattended epic-branch run so far has needed operator recoveries within minutes of a trigger, and the reconciler never applies them. That is why the one command both creates and drives the run: the session that launched it stays to apply the sanctioned recovery verbs.

## Completion advisory — saved epic plans and tickets

This pattern is for a completion handoff that recommends launch, outside
`/drive-epic-run`'s Stage 0. It is read-only and adds no mandatory launch gate.

Eligibility requires a concrete epic key, finalized real child keys (no `TBD-N`),
and the actual `epic-plan.dag.json` and `epic-plan.meta.json` artifacts. Free-form
plans, missing keys, and unfinished artifacts receive boundary guidance only.
Run at most one eligible preview per completion; do not automatically rerun it on
later turns of that completion. Ordinary ticket definition needs no preview.

Resolve `<launcher>` once using `/drive-epic-run` Stage 0 operation 3's trusted
command-prefix convention. Preserve multiword prefixes such as
`node /absolute/path/to/mcp_server/build/index.js`; never quote the entire prefix
as one executable. Independently escape and single-quote every dynamic argument:

```bash
<launcher> drive-epic '<EPIC>' --dry-run --json
```

Retain `--plan-file '<path>'` only when actual plan selection requires it. Use the
host's command timeout seam to impose a **60-second** wall-clock limit and cancel
the read-only child where supported. If bounded execution is unavailable, report
**readiness not confirmed** without starting an unbounded operation.

Parse authoritative JSON regardless of exit status, including nonzero refusals.
Validate it using `/drive-epic-run` Stage 0 operation 4's existing schema and
contradictions checks.
Report the selected `target.kind` and `target.base_url`; render `refusal.reason_id`
and `refusal.remedy` verbatim, falling back to `readiness.reason_id` and
`readiness.remedy` when refusal is null. Relay any supplied `availability_text`
verbatim without substituting generic VCS/indexing advice. A `stop` decision
reports the returned plan status/candidates and finalization remedy. Never invent
fields or an independent readiness rule.

An ordinary successful `create` or `attach` preview is **ready at preview time**.
A `cold_start` create is conditional: `summary.server_validation` is partial, and
guarded startup and live validation must still succeed. A generated-plan cold
start (`cold_start.live_run_checked` is `true`) confirmed no live run during
generation; any other cold start did not check live-run existence. It is never a promise of launch readiness. Malformed, unavailable,
throwing, or timed-out previews mean **readiness not confirmed**. Retain planning
success and offer the same preview command for a later user-initiated retry.

Present **Plan/tickets saved → Readiness preview → Launch next step**. Planning
and ticket creation establish neither executor, policy, VCS, nor indexing
readiness. Reproduce only actual unmet dependencies and returned remedies.
Never create, start, approve, provision, index, or schedule anything from this
advisory. Preserve actual launch consent and `drive-epic` admission; do not invoke
`/drive-epic-run` Stage 0's launch, health check, or second advisory-read
operations here.

## Return

This procedure returns nothing on its own. After each section, go back to the
`/define-tickets` Stage 9 pointer that sent you here and continue from that point.
Report the outcome of the section you just followed in the command's own terms: the
gap-check outcome and record path, the clearance result, the saved DAG and metadata
paths, or the hand-off sections shown. A halt keeps the command's halt reason and
terminal contract; this procedure adds no halt reason and no terminal field.

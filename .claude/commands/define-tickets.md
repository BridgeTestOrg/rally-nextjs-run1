Explore the codebase for a task, settle its acceptance criteria with the user, then propose a design that meets them.

$ARGUMENTS

---

# Instructions

`$ARGUMENTS` is a free-form prompt describing a task you want to accomplish and your goals for it. This is **not** a Jira ticket key — it is plain text describing the work.

`$ARGUMENTS` accepts three flags, parsed in Stage 0: `--auto`, `--allow-duplicate`, and `--max-children=N`. Without `--auto`, every attended gate below runs exactly as written, and no flag grants a gate bypass.

Execute all exploration and analysis directly in the main conversation. The user should see exploration progress as it happens.

This command runs strictly outside-in, and the order is the point:

1. **Requirements first.** Establish what the system must do, how it must behave, and what standards it must meet — then get the user to ratify that on an interactive decision page. The page settles **requirements and ticket scope**. It never asks the user to pick a technical implementation.
2. **Then how.** Only once the criteria are ratified do you consider how to meet them, optionally with a council.
3. **Then the design.** You describe the final proposed design yourself, in the exploration doc. There is no second decision page.
4. **Then ticket(s).**

Never invert this. A design proposed against unratified criteria is a guess, and an implementation choice presented before the criteria are settled asks the user to commit to a solution for a problem they have not yet agreed on.

If any critical stage fails, stop immediately and report which stage failed and why.

## Attended path contract

An attended run takes one of two paths, chosen at the end of Stage 1 (see "Choose the path"). The paths differ only in how the implications review and the drafting plan are presented and whether they stop. Neither path skips a review, and neither weakens ratification.

| Path | Page | Implications | Plan | Upload |
| --- | --- | --- | --- | --- |
| Full | Generate and ratify | Separate stop | Separate stop | Explicit stop |
| Short | Generate and ratify | Combined message | Same message, normally no stop | Explicit stop |

Both attended paths keep the HTML requirements page with its ticket-count card, checkable acceptance criteria, `jira-ticket-writer` drafted bodies, and the explicit upload gate. These attended path rules do not apply under `--auto`: an `--auto` run has no path, no combined presentation, no path switch, and no overlap line. It keeps only the general speed-ups that this file marks as applying to both modes (the Stage 1 stop rule, research packets, the materials pre-check, and run timing).

## Run timing (both modes)

Measure where the time goes. Never estimate it.

- **Host clock.** Take readings with `date +%s` in the shell. Take the first reading at command entry, before any argument processing. This adds no dependency resolution and changes no validation behavior. Remember the precedent in `/drive-epic-run`: durations come from the host clock, and an unavailable measurement is reported as unavailable, never invented.
- **When to sample.** Sample at every stage boundary; immediately before yielding at each stop (the page, the implications checkpoint, the drafting plan, the upload gate, and any discussion turn that waits on the owner); as the first action of every owner reply turn; and at each writer launch and each writer finish.
- **Intervals.** Record three kinds, each with its own attempt number: a `stage` attempt (a stage entered again is a new attempt), an `owner_wait` interval (from the sample taken just before yielding to the sample taken first in the reply turn), and a `writer` attempt (one per launch, including retries and revisions). Do not open a second wait interval for the same yielded turn. Name intervals with stable stage names (`stage-0` … `stage-9`) and generated entry identities (`parent`, `child-{N}`, `sibling-{N}`), never ticket titles or other ticket content.
- **Seconds.** A stage attempt's active seconds are its end minus its start, minus only the valid owner-wait intervals that fall inside that segment, with no interval subtracted twice. Owner wait is host-observed time. It is not exact browser delivery or reading time.
- **Not measured.** A segment is `not measured` when a required reading is missing, malformed, or affected by a backward clock jump. Keep the other valid segments. Never present an incomplete subtotal as a complete duration, and never turn a missing value into an estimate or a zero.
- **Writers.** Writer seconds overlap stage time and may overlap each other. Keep them separate and never add them to a stage total. The static estimates in the Stage 6 drafting plan are guidance only and never appear in a measured record.

Persist the measurements in two places. Both are described where they are produced: the `## Run timing` table in Stage 4, and the one-line JSONL record in "Timing record" at the end of the Final Report section.

## Auto mode (--auto)

`--auto` runs this command unattended. Every instruction marked **Only under --auto:** is skipped in attended mode, and every attended instruction stays as written for attended runs.

- `--auto` authorizes ticket creation **only after every gate clears**. It authorizes council cost only when that cost is stated before the council is requested.
- It sets Stage 6 `auto_approve` to the literal `true`, and binds `auto_approve_external = "true"` for the coherence procedure and its preflight.
- It never records an `accept` or `bypass` override. It never treats proposed requirements as ratified: every criterion and NFR stays `proposed, unratified`.
- Every auto stop, from Stage 0 onward, ends with the terminal contract in the Final Report.

## Stage 0 — Setup

1. **Parse flags and prompt**: Before anything else, take the first host-clock reading (`date +%s`) described under Run timing. Tokenize `$ARGUMENTS` on whitespace. Recognize these flags in any position, with no ordering requirement:
   - `--auto` — unattended mode (see Auto mode above).
   - `--allow-duplicate` — sets `allow_duplicate` to the literal `"true"`; otherwise it is `"false"`.
   - `--max-children=N` — the portfolio cap. `N` must be a positive integer; the default is `10`.

   Build the prompt text only from the non-flag tokens, joined with single spaces. No flag token is ever part of the prompt. `--allow-duplicate` and `--max-children` are accepted but have no effect without `--auto`, and they add no attended prompt.

   Any other token beginning with `--`, and any `--max-children` value that is non-positive or not an integer, is an invalid flag. Under `--auto`, stop with a `stage_failed` halt naming Stage 0 and the token. In attended mode, ask the user what the token meant; never fold it into the prompt.

   If the prompt is empty or whitespace-only, stop immediately and display: `Usage: /define-tickets <prompt describing your task and goals> [--auto] [--allow-duplicate] [--max-children=N]`

2. **Resolve docs directory**: Call the `ping` MCP tool (no parameters) and read `docs_dir` from its first (JSON) content item. Store that path as `docs_dir`.

3. **Generate output slug**: Create a kebab-case slug from the prompt — take the first 6-8 meaningful words, strip non-alphanumeric characters, lowercase, and truncate to 60 characters. The slug **must start with a letter** so it is a valid decision-page `ticket_key` in Stage 5 (`/^[A-Za-z][A-Za-z0-9_-]*$/`); if it would start with a digit or hyphen, prefix it with `exploration-`. If `{docs_dir}/explorations/{slug}.md` already exists, append a short timestamp suffix (e.g., `-1710000000`) — and fold that suffix **into the `slug` variable itself**, not just the filename, so that Stage 4 (the doc), Stage 5 (`ticket_key`, `output_filename`), and Stage 8 (the doc rewrite) all reference the same slug. The output file path is `{docs_dir}/explorations/{slug}.md`.

4. **Initialize tracking**: Prepare to track `key_files_examined` (list of files read during exploration), `web_searches` (list of topics searched), and `research_queries` (list of deep research queries). Also prepare the timing observations from Run timing: `stage_attempts`, `owner_waits`, and `writer_attempts`, each a list of `{name, attempt, start, end, seconds}` entries where a missing value is `null`. Buffer the observations taken before `docs_dir` and the slug exist (the entry reading and Stage 0 itself), and persist them once both exist. Also prepare `run_path` (`short`, `full`, or `auto`) and `escalated` (`false`) for the path decisions below.

5. **Project standards.** Only under --auto: create a unique local run id (for example the current epoch seconds) and the artifact directory `{docs_dir}/explorations/{slug}-{run_id}/`, then call `get_project_standards` once, before readiness. Treat a 404, an error envelope, a missing response, or an onboarding placeholder as unavailable: warn and continue. Retain the result, or an explicit `standards unavailable` state, for every writer and for the Final Report.

6. **Readiness.** Only under --auto: immediately after standards, read the readiness procedure at `.bridge/procedures/preflight-and-readiness-procedure.md` in this project, where the Bridge installer scaffolds it. Only if that file does not exist, read `docs/install/preflight-and-readiness-procedure.md` (the location older installs used). Only if that file does not exist either, read `mcp_server/instructions/preflight-and-readiness.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. If it is unreadable or none of the three exists, halt as `stage_failed` naming Stage 0. Follow its define-tickets path, naming the slug, the run id, and the artifact directory in the invocation. If readiness is `too_vague_to_ticket`, halt before Stage 1 as `too_vague`. Record the scope axis only; it does not decide the eventual ticket shape.

At this procedure-read failure, retain the source-checkout fallback and the stage's existing refusal or optional warning/skip behavior. Name the exact `.bridge/procedures/preflight-and-readiness-procedure.md` procedure and affected stage/keys. On Linux, from the established project root, run `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <claude|cursor|codex|copilot>` in a terminal (quote the root for the shell). On macOS and Windows, in-place repair is unsupported: re-run start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds. Repair fills missing packaged files only; resolve permission/non-file/unsafe-link problems separately. Refresh/reconnect, reread that same procedure, and resume only if the original stage allows it. Do not repair customer instruction overrides.

If this stage fails, stop immediately and report the error. Do not proceed to Stage 1.

## Stage 1 — Codebase Exploration

This is the core discovery stage. It applies in both modes. Explore until the stop rule at the end of this stage is met, then stop.

1. **Analyze the prompt** to identify which areas of the codebase are relevant: route files, agent flows, database models, library utilities, LLM integration, MCP server, unit and E2E suites, etc.

2. **Search for files** matching patterns related to the task (e.g., `api/routes/**/*.py`, `src/python/llms/agents/**/*.py`, `db/models/*.py`).

3. **Search for content** — relevant function names, class names, patterns, and keywords across the codebase.

4. **Read the most relevant files** in detail — understand existing implementations, conventions, and patterns that relate to the task.

5. **Build a mental model** of:
   - What exists today that relates to the task
   - What patterns and conventions are used in similar features
   - What dependencies, data flows, and integration points are involved
   - What gaps or unknowns remain that need external research
   - Whether there is an established precedent for this kind of work, or none at all — Stage 7 depends on this judgement

Explore to understand the problem and its constraints. Resist designing a solution while you read — you do not yet know what the system is required to do, and Stage 8 is where the design gets written.

6. **Track all significant files** examined in `key_files_examined`.

**Stop rule.** Stop exploring once you can name all four of these: the affected behavior, the files to change, the relevant callers and tests, and the risks. Do not keep reading to feel more certain. If a named uncertainty remains, investigate that uncertainty narrowly (the specific file, caller, or test that would settle it) rather than widening the sweep. Record the evidence for the four items with concrete `path:line` citations, because Stage 4 and the writer research packets in Stage 9 are built from it.

7. **Choose the path (attended only).** Under `--auto`, skip this item: there is no path, so set `run_path` to `auto`. In an attended run, decide whether the run takes the short path or the full path, using the evidence from this stage and the Attended path contract above.
   - **Short path** only when all three hold: the work is likely 1-2 implementation tickets; an established precedent exists in this codebase for this kind of work; and the work touches none of the forced-full areas.
   - **Full path** whenever any of the three conditions is unmet or you are unsure. Uncertainty always resolves to full.
   - **The five forced-full areas:** security/auth; data model or migrations; billing; public API or MCP tool contracts; irreversible operations.
   - If the owner asked for the "full path" earlier in this conversation, honor that request in this initial selection.
   - Announce the choice in one line with its reason, for example `Path: short — one ticket, follows the existing <precedent>, no forced-full area.` or `Path: full — touches billing.` Record it in working state as `run_path` (`short` or `full`) and keep `escalated` as `false`. The owner can say "full path" at any point; see Switch to the full path in Stage 6.

This stage is non-blocking — always proceed to Stage 2 regardless of what you find, since the exploration informs what research is needed.

## Stage 2 — Research Unknowns

Based on gaps identified in Stage 1, decide what research is needed. Apply these decision rules:

- **No research needed**: The codebase exploration answered all questions. Skip directly to Stage 3.
- **Web search**: For quick factual lookups — library API signatures, configuration syntax, small "how to" questions. Examples: "FastAPI dependency injection with custom headers", "Alembic batch migration syntax". Do web searches inline and capture relevant findings.
- **Deep research** (via `request_deep_research` MCP tool): For large, multi-faceted unknowns that require synthesizing information from multiple sources. Examples: "Best practices for implementing WebSocket connection pooling in Python asyncio", "Tradeoffs between different approaches to real-time notification delivery in FastAPI applications". Only use deep research when the question genuinely needs a multi-source investigation.

**If deep research is needed:**

1. Call `request_deep_research` with `wait_for_result` set to `true`, `save_locally` set to `true`, a descriptive `query`, and `context` describing the Bridge API tech stack and the specific task.
2. If deep research fails, note the failure and fall back to web searches for the same topic. Do NOT halt the pipeline.

Track all research performed in `research_queries` and `web_searches`.

This stage is non-blocking — failures degrade the quality of analysis but do not stop the command. Log a warning for any failed research and continue.

**Only under --auto:** after this stage, run the duplicate scan. Read `.bridge/procedures/duplicate-and-context-scan-procedure.md` in this project first. Only if that file does not exist, read `docs/install/duplicate-and-context-scan-procedure.md`; only if that file does not exist either, read `mcp_server/instructions/duplicate-and-context-scan.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. If it is unreadable or none of the three exists, halt as `stage_failed` naming Stage 2. Follow its define-tickets path, naming the slug, the run id, the resolved `allow_duplicate` literal, and the artifact directory in the invocation. Halt as `duplicate` on a known duplicate unless `allow_duplicate` is `"true"`. Halt an `unable_to_check` result as `stage_failed` naming the duplicate scan; `--allow-duplicate` never overrides it. This is the one halting check in this stage.

At this procedure-read failure, retain the source-checkout fallback and the stage's existing refusal or optional warning/skip behavior. Name the exact `.bridge/procedures/duplicate-and-context-scan-procedure.md` procedure and affected stage/keys. On Linux, from the established project root, run `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <claude|cursor|codex|copilot>` in a terminal (quote the root for the shell). On macOS and Windows, in-place repair is unsupported: re-run start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds. Repair fills missing packaged files only; resolve permission/non-file/unsafe-link problems separately. Refresh/reconnect, reread that same procedure, and resume only if the original stage allows it. Do not repair customer instruction overrides.

## Stage 3 — Frame Acceptance Criteria

Establish what "done and correct" means. Everything in this stage is about the system's obligations, not its implementation. Do not name a technical approach here — that is Stage 8's job, and it does not happen until the user has ratified this framing.

1. **State the frame plainly (required).**
   - **Business goal** — the value this work delivers and why it matters.
   - **Desired end-state** — the concrete state the system should reach once this work is done.
   - **System behavior** — how the system must behave to complete its task (the quality attributes in prose, not a feature list).

2. **Derive the acceptance criteria — what the system must do (required).** Write 3-8 criteria. Each one gets:
   - An `id` (`AC-1`, `AC-2`, …).
   - A `criterion` — a single obligation stated concretely enough to be checked. Write it as observable behavior ("an operator who revokes a key sees the next request rejected"), not as a task ("add a revocation endpoint").
   - A `verification` — how we would confirm it holds. Name the observable signal: a response code on a specific route, a row state, a log line, a rendered element, a user-visible outcome. **A criterion nobody can check is not yet a criterion** — sharpen it or drop it.
   - A `status`, using the rubric in step 4.

   Cover the failure and edge behavior, not just the happy path. If the work changes something that already exists, at least one criterion should pin down what must **not** regress.

3. **Identify the non-functional requirements — the standards the system must meet (required).** Consider every one of these canonical NFR categories and include the ones that genuinely apply (omit the rest): security/privacy, performance/latency, reliability/failure-modes, observability/auditability, accessibility/UX, data-integrity/migration, compatibility, operability/config, compliance/SOC2, rollout/reversibility. For each NFR you include, write its `requirement` and its `implication` (what it changes about the implementation) — an NFR with no concrete implication is boilerplate; drop it.

4. **Classify every acceptance criterion and every NFR** with this rubric: `confirmed` only if explicitly stated or observable in code; `assumed` only if a low-risk, reversible default; `open` if it touches architecture, the data model, security, user-visible behavior, migration, or irreversible creation and is not settled. When a criterion or an NFR is genuinely unclear, prefer marking it `open` and asking. Clear criteria make everything downstream more accurate, so surfacing an unclear one is a success, not a delay.

5. **Frame the open requirement questions.** Where a requirement is unsettled **and** has discrete candidate answers, express it as a question the user can answer by clicking (e.g. "Must revocation take effect immediately, or is eventual acceptable?"). These become cards in Stage 5. They are questions about *what the system must do* — never about how to build it. If a question has no discrete answers, leave it as prose in the doc instead.

**Attended ticket scope (required).** Before Stage 4, frame a Scope question with stable id `SCOPE-1`: "How many implementation tickets should encompass these requirements?" Recommend a positive integer count based on the full requirements, Stage 1 evidence, and the existing Stage 9 sizing guidance. Describe the approximate responsibility of each proposed ticket without choosing a technical implementation. Count implementation tickets only: an epic parent is additional, and must be disclosed separately when the proposed count is three or more. Every count option must cover all requirements; never offer a reduced-requirements option or manufacture tiny slices just to supply an alternative. Offer 2-4 options: concrete count alternatives where credible, or the recommended count plus "Discuss a different ticket count" when no credible alternative exists. Explain the coverage and sizing consequences of each and recommend exactly one concrete count. This question is mandatory even when all requirements are already settled. Under `--auto`, skip this attended scope framing; the existing design, split, and portfolio-cap rules remain authoritative.

6. **Sanity-check the frame against itself.** Do any two criteria conflict? Does a criterion conflict with an NFR (e.g. an auditability requirement against a latency budget)? Note every tension you find — Stage 7 treats these as a council trigger, and Stage 8 must resolve them explicitly rather than quietly favouring one side.

This stage is inline analysis — no tool calls required. This stage is non-blocking — always proceed to Stage 4.

**Only under --auto:** at the end of this stage, halt as `open_requirements` if any acceptance criterion or NFR is still `open`, and list those items. Rely on the Stage 1 evidence and the conservative `confirmed` / `assumed` rubric in step 4. Do not add a minimum-evidence halt. Do not run a separate screening procedure.

## Stage 4 — Write Requirements Draft

Write what you know so far to disk, so the user has something to read alongside the decision page. The design is deliberately absent — it does not exist yet.

1. Create the `explorations/` directory under `docs_dir` if it does not exist.

2. Write the exploration document to the slug-based path determined in Stage 0 (`{docs_dir}/explorations/{slug}.md`) with this structure:

```markdown
# Exploration: {concise summary of the prompt}

**Date**: {current date}
**Prompt**: {original prompt text}
**Status**: Requirements drafted — awaiting ratification (under `--auto`: Requirements proposed, unratified)

## Context

{Brief description of the task and what areas of the codebase are relevant. Attended only: the chosen path (short or full) and the reason from Stage 1; add any later switch to the full path with its trigger. Under --auto, omit the path.}

## Acceptance Criteria

{The criteria from Stage 3 — what the system must do. One entry per criterion: its id, the criterion itself, how it is verified, and its status (confirmed / assumed / open).}

## Goals & NFRs

{The business goal, desired end-state, and required system behavior from Stage 3. Then the non-functional requirements — the standards the system must meet: each with its category, requirement, implication, and status (confirmed / assumed / open). Note any tension between criteria or between a criterion and an NFR.}

## Ticket Scope

{Attended only: the proposed implementation-ticket count, its rationale, each ticket's approximate responsibility, and the alternatives for SCOPE-1. Mark it proposed until explicitly agreed; disclose any additional epic parent. Under --auto, omit this section.}

## Open Questions

{Requirement questions that are still unsettled. Mark which ones are going onto the decision page as cards and which are open-ended prose.}

## Codebase Findings

{Key discoveries from Stage 1, organized under the four stop-rule categories: the affected behavior, the files to change, the relevant callers and tests, and the risks. Name each with concrete file_path:line_number citations, and note the precedent to follow. Also note what exists today and which patterns are used.}

## Research Findings

{Findings from web searches and deep research, if any. If no research was performed, state "No external research was needed."}

## Key Files

{Bulleted list of the most important files examined, with one-line descriptions of their relevance.}

## Run timing

{The measured intervals from Run timing, as a table with exactly these columns: `Kind | Name | Attempt | Start | End | Seconds`. One row per stage attempt, owner-wait interval, and writer attempt, with `Kind` set to `stage`, `owner_wait`, or `writer`. Render any unavailable, malformed, or backward-clock value as `not measured`, never as an estimate or a zero. Create the section with the rows measured so far, and update it as later measurements arrive.}
```

**Timing in the document.** Persist the buffered observations once `docs_dir` and the slug exist, and update the `## Run timing` table as measurements become available rather than only at the end. An initial timing-only write is best-effort: if it fails, keep the observations in working state and continue. Preserve the `## Run timing` section through Stage 4 creation, the Stage 6 updates, and the Stage 8 rewrite. This does not change the failure behavior below for writing the substantive exploration document.

Do not add a design, an implementation plan, or a technical recommendation to this draft. Stage 8 adds those once the criteria are settled. The attended Ticket Scope section must include the ticket-count recommendation from Stage 3.

**Only under --auto:** label every acceptance criterion and every NFR `proposed, unratified` in the document, and use `Requirements proposed, unratified (--auto)` as the Status line instead of the attended status. No one has ratified them.

If the file cannot be written, stop immediately and report the failure.

**Only under --auto:** after the document is written, and before Stage 8, run the comp analysis. Read `.bridge/procedures/comp-analysis-procedure.md` in this project first. Only if that file does not exist, read `docs/install/comp-analysis-procedure.md`; only if that file does not exist either, read `mcp_server/instructions/comp-analysis.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. If it is unreadable or none of the three exists, halt as `stage_failed` naming Stage 4. Follow its define-tickets path, naming the artifact directory in the invocation; it writes `comp-analysis.json` there. Continue on a degraded analysis, which records `applicable: false`, a reason, and warnings; carry those warnings and the material needing manual review to the Final Report.

At this procedure-read failure, retain the source-checkout fallback and the stage's existing refusal or optional warning/skip behavior. Name the exact `.bridge/procedures/comp-analysis-procedure.md` procedure and affected stage/keys. On Linux, from the established project root, run `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <claude|cursor|codex|copilot>` in a terminal (quote the root for the shell). On macOS and Windows, in-place repair is unsupported: re-run start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds. Repair fills missing packaged files only; resolve permission/non-file/unsafe-link problems separately. Refresh/reconnect, reread that same procedure, and resume only if the original stage allows it. Do not repair customer instruction overrides.

## Stage 5 — Generate Requirements Decision Page

**Only under --auto:** skip this stage entirely. Do not call `generate_decision_page`, and go to Stage 6. The attended instructions below are unchanged.

Turn the Stage 3 framing into an interactive HTML decision page so the user can ratify the requirements by clicking. **This page settles requirements and ticket scope.** It must not contain a single technical implementation option — the user is agreeing on what the system must do and how many tickets should encompass it.

1. **Map the acceptance criteria to `acceptance_criteria`.** Each entry has `id`, `criterion`, `verification`, and `status`. Ids must be unique — a duplicate id is rejected, because the id is the key the page reports the user's stance under. Every criterion renders with an Agreed / Ask about this / Disagree control, so pass all of them, not only the open ones. Pass the NFRs the same way under `nfrs`.

2. **Map each open requirement question from Stage 3 step 5 to an actionable item.** Each entry has:
   - `id`: a short stable id, e.g. `R-1`, `R-2`.
   - `question`: the requirement question.
   - `options`: the 2-4 candidate answers (string array). Do **not** include "None of these" or "Ask about this" — the renderer auto-appends both.
   - `option_consequences`: what each answer would mean for the criteria, **parallel to and the same length as** `options`.
   - `why_it_matters`: the concrete impact line.
   - `recommendation_explanation`: why the recommended answer is best.
   - `recommendation_index`: the 0-based index of the recommended answer (must be within `options`).
   - `codebase_evidence` (optional): the Assessment paragraph plus `file:line` citations, shown collapsed.

   **The open-requirement cards are requirement questions, never implementation choices.** "Must revocation be immediate or is eventual acceptable?" is a valid card. "Should we use a short-TTL cache or pub/sub invalidation?" is not — it is a solution, it belongs to Stage 8, and putting it here defeats the purpose of the page. If you cannot phrase a card without naming a mechanism, it is not a requirement question. Always include the Stage 3 Scope question as an additional actionable item with id `SCOPE-1`, even when there are no open requirement questions. Give it the same `options`, parallel `option_consequences`, `why_it_matters`, `recommendation_explanation`, and valid `recommendation_index` fields as the other cards. Recommend a concrete count, not the discussion option. Never pass an empty `actionable_items` array from this command. Ticket scope is a planning constraint; it does not select a technical mechanism.

3. **Call `generate_decision_page`** with routing fields at the root and all heavy arrays nested under `content`:
   - `artifact_type`: `pre_ticket_planning` (renders the acceptance-criteria and goals panel above any cards).
   - `ticket_key`: the Stage 0 `slug` (a non-Jira slug is fine — it must start with a letter and contain only letters, digits, hyphens, or underscores).
   - `output_subdir`: `explorations` (so the page lands beside the markdown doc).
   - `output_filename`: `{slug}-requirements.html`.
   - `labels`: requirements-flavored overrides, e.g. `title` = "Requirements & Ticket Scope", `section_heading` = "Requirements & Scope Questions", and an `intro` that frames the page as agreeing on what the system must do and how many implementation tickets should encompass it before design work begins.
   - `content`: an object containing `system_goals` and `actionable_items`. **`system_goals` MUST ALWAYS be passed** inside `content` so the backend always writes a page. Never omit it, even if every criterion and NFR is confirmed. `acceptance_criteria` and `nfrs` both live inside `system_goals`. (Do not pass `implementation_order` inside `content` — that is for epic surfaces, not a single explored task.)

   ```typescript
   interface ExploreTicketContent {
     system_goals?: {
       business_goal: string;
       desired_end_state: string;
       system_behavior: string;
       acceptance_criteria?: Array<{
         id: string;                    // e.g. "AC-1"; must be unique
         criterion: string;             // what the system must do
         verification: string;          // how we would confirm it holds
         status: "confirmed" | "assumed" | "open";
       }>;
       nfrs?: Array<{
         category: string;
         requirement: string;
         implication: string;
         status: "confirmed" | "assumed" | "open";
       }>;
     };
     actionable_items?: Array<{
       id: string;                      // "SCOPE-1" for ticket count; "R-1", etc. for requirement questions
       question: string;
       why_it_matters: string;
       recommendation_explanation: string;
       options: string[];               // 2-4 candidate answers (no "None of these" or "Ask about this")
       option_consequences: string[];   // same length as options
       recommendation_index: number;   // 0-based within options
       codebase_evidence?: string;      // optional: assessment + file:line citations
       original_question?: string;      // optional: only when item maps to a verbatim question
     }>;
     // clear_improvements: not used by this command — it captures requirements, not findings
     // implementation_order: for epic surfaces only — do NOT include for single task explorations
     // depends_on: hard prerequisites (titles/keys that must land first)
     // recommended_after: soft sequencing preferences, not hard blockers
   }
   ```

   Example call:
   ```json
   {
     "ticket_key": "revoke-api-keys",
     "artifact_type": "pre_ticket_planning",
     "output_subdir": "explorations",
     "output_filename": "revoke-api-keys-requirements.html",
     "labels": { "title": "Requirements & Ticket Scope", "section_heading": "Requirements & Scope Questions" },
     "content": {
       "system_goals": {
         "business_goal": "Operators can cut off a leaked key immediately.",
         "desired_end_state": "Revocation is self-serve and takes effect at once.",
         "system_behavior": "Rejects revoked credentials without a restart.",
         "acceptance_criteria": [
           { "id": "AC-1", "criterion": "An operator who revokes a key sees the next request with it rejected.", "verification": "The following call to the protected route returns 401.", "status": "confirmed" },
           { "id": "AC-2", "criterion": "Revocation is recorded with actor and timestamp.", "verification": "An audit row names the operator and the revoked key id.", "status": "open" }
         ],
         "nfrs": [
           { "category": "security/privacy", "requirement": "The raw key is never logged on the revoke path.", "implication": "Log the key id, never the secret.", "status": "open" }
         ]
       },
       "actionable_items": [
         {
           "id": "SCOPE-1",
           "question": "Scope: How many implementation tickets should encompass these requirements?",
           "why_it_matters": "Sets the agreed ticket count while preserving every requirement. An epic parent is additional for three or more implementation tickets.",
           "recommendation_explanation": "One ticket keeps this cohesive revocation change and its verification together within the existing sizing guidance.",
           "options": ["1 implementation ticket: revocation behavior and verification", "Discuss a different ticket count"],
           "option_consequences": ["Cover every requirement in one implementation ticket, with no epic parent.", "Agree a concrete count and coverage boundaries in chat before design work begins."],
           "recommendation_index": 0
         },
         {
           "id": "R-1",
           "question": "Must revocation take effect immediately, or is eventual acceptable?",
           "why_it_matters": "Sets the hard bound AC-1 has to meet.",
           "recommendation_explanation": "A leaked key is an active incident; eventual leaves a usable window.",
           "options": ["Immediately (under 5s)", "Eventually (under 60s is acceptable)"],
           "option_consequences": ["AC-1 gains a 5s bound.", "AC-1 gains a 60s bound."],
           "recommendation_index": 0
         }
       ]
     }
   }
   ```

4. **Handle the response `status`:**
   - `no_decisions_needed`: no page was written. This should not occur when `system_goals` is always passed. Warn that the page was not written and use the Stage 6 chat fallback to settle both requirements and ticket scope; never bypass scope agreement.
   - `decision_page_generated`: surface the returned `file_path` and proceed to Stage 6. **Always proceed to Stage 6 when `decision_page_generated` is returned**, regardless of `actionable_items_count`. An unexpected zero-card response still requires requirements and scope agreement; it never bypasses Stage 6.

This stage is non-blocking: if `generate_decision_page` fails, do not halt. **You MUST output a highly visible warning** (e.g. **⚠ WARNING: The requirements page could not be generated** in bold) explaining that generation failed and that the user should review the criteria in the markdown doc written in Stage 4 instead. Do not silently continue — the failure must be diagnosable from your output. Then use the Stage 6 chat fallback to confirm both the criteria and a concrete implementation-ticket count before proceeding to Stage 7.

## Stage 6 — Ratify Requirements

**Only under --auto:** there is no page and no operator. Skip items 1 through 4, the page-commit loop, the implications confirmation prompt, and the drafting plan display. Produce the item 5 implications review from the proposed set and write it under `## Implications`. Compute the recommended drafting plan with the item 5 rules and record it in working state without showing it, then state the option taken in the Final Report. Pass no coherence `council_preapproval`, and never record `declined_by_operator`. Never record an attended acceptance or bypass override either. Map `--auto` to the literal `auto_approve = true` path in item 5. In item 6, keep the criteria `proposed, unratified`, set the Status line to `Requirements proposed, unratified (--auto)`, and never set "Requirements ratified". The attended instructions below are unchanged.

Capture the user's stances, settle the criteria, gate on the implications review, and fold the result into the doc. Nothing downstream — including a council in Stage 7 — may start until the criteria are agreed and the final Stage 6 answer has advanced.

**Path (attended only).** The separate-turn implications checkpoint and the separate drafting-plan turn described in item 5 are the full path. When `run_path` is `short`, item 5's short-path presentation shows the review and the plan together in one message instead, and the final Stage 6 answer is that message unless an exceptional stop applies. Re-evaluate the Switch to the full path triggers below on every owner reply in this stage.

1. **Direct the user to the page.** Provide the `file_path` from Stage 5 and tell them to open it in their browser. Explain that they are agreeing on what the system must do and the implementation-ticket count — that they can accept, question, or reject each criterion, and that they can ask questions in chat before submitting.

2. **Q&A loop and commit signal.** Engage with each user message as either a commit or a discussion turn:
   - **Commit:** trim the full message and attempt to parse the entire trimmed message as JSON. Treat it as a commit only when the parsed value is an object with all three top-level fields: `ticket_key` (string), `decisions` (object), and `general_comment` (string). The first valid commit-shaped paste commits — do not over-validate the per-card fields. The page also submits `acceptance_criteria_feedback` and `nfr_feedback` objects, each keyed by criterion id or NFR category with a `stance` of `agreed`, `ask`, or `disagree` plus a `comment`.
   - **Discussion:** anything that is not commit-shaped JSON. Answer from the doc written in Stage 4 and from codebase lookups. If a JSON-shaped paste is missing one of the three required fields, say which field is missing rather than treating it as a freeform question.
   - **In-flight overrides:** when the user clearly changes an answer in chat ("AC-2 is wrong", "go with eventual for R-1") or gives new overarching guidance, record it as a working-memory override. On commit, the submitted JSON is the baseline and recorded overrides take precedence; post a one-line acknowledgement naming each overridden item before you rewrite the doc.

3. **Resolve every "ask" (hard rule).** After accepting a commit, scan all three: any item in `decisions` where `choice === "ask"`, any entry in `acceptance_criteria_feedback` where `stance === "ask"`, and any entry in `nfr_feedback` where `stance === "ask"`. For each, present the relevant evidence and continue the discussion until the user gives an explicit answer, which you record as an override. Do not proceed while any `ask` remains unresolved — do not honor "just skip those".

**Settle ticket scope (attended only, before item 5).** Resolve `SCOPE-1` from the submitted `decisions` using the offered option and any explicit chat overrides. A missing answer, `choice === "ask"`, `choice === "none"`, or "Discuss a different ticket count" requires discussion until the user explicitly agrees a positive integer count covering every requirement. Never infer agreement from the recommendation or from an unrelated approval. Record the agreed count, rationale, and approximate responsibilities in working state as `ticket_scope`; this is a binding planning constraint, not a system acceptance criterion. If generation failed, returned `no_decisions_needed`, or omitted the scope card, present the same scope question and recommendation in chat and explicitly settle it alongside the criteria. The fallback does not require a page commit JSON. Do not start the implications review, council, design, or drafting with unresolved ticket scope.

4. **Resolve every "disagree".** A disagree means the criterion is wrong as written. Work out with the user what it should say, restate it back, and get explicit agreement on the corrected wording. A rejected criterion is either rewritten or dropped — never carried forward as-is.

5. This surface's tracked stances are the `acceptance_criteria_feedback` and `nfr_feedback` objects captured above. **Review the wider implications, then gate on a decision.** Build the review from the complete settled set: the submitted `decisions`, any in-flight overrides recorded during the conversation (these take precedence over the submission), every `"none"` answer together with the reason given for it, `general_comment`, and — where this surface tracks acceptance-criterion or NFR stances — those stances too. Do not start the review until every `ask` has an explicit recorded resolution and every in-flight override has been applied.

   Consider three fixed categories, regardless of whether a decision was framed as technical, user-facing, or business-oriented:
   - **Program / application** — architecture, code paths, operability, maintenance burden, and requirements imposed on other parts of the software.
   - **User** — end users, new users performing setup, operators, and developers, including prerequisites, setup friction, and additional steps.
   - **Business** — cost, adoption, support load, compliance, and reversibility.

   Emit only the categories with material second-order implications. For each included category, write at most four one-line bullets of about 25 words, each naming who or what is affected and how — never a restatement of the selected decision. Close with a line naming every considered category that was omitted, e.g. `Considered, nothing material: business.` — omit this closing line only when all three categories have material implications.

   If the review cannot be produced, report that in one line (for example `Implications review unavailable.`) and skip only the missing review content. Record the assessment as unavailable, not as immaterial: its signals are neutral and the remaining evidence decides the recommendation. In an attended run, still present the checkpoint below and wait for a clear request to proceed before showing the drafting plan. On the short path, the unavailable notice instead appears at the top of the combined message, and the run follows the short-path continuation rules below; an unavailable review is not by itself an owner-only decision.

   Retain the latest emitted review; once the gate below allows continuation, write it under `## Implications` during the Stage 6 document rewrite.

   **Settle the implications in a separate turn.** In every attended run, end the review turn by asking: `Do these implications look right? You can confirm, ask a question, request a change, or tell me to proceed.` Do not show or select the drafting plan in that turn. A clear confirmation or request to proceed settles the implications and advances to the drafting plan in the next turn. Silence or an unclear reply advances nothing; clarify and present the checkpoint again. Answer questions using the requirements and codebase evidence, then present the checkpoint again without showing a plan. If the user changes a requirement or corrects an implication, settle that change, apply the override, rerun the entire implications review against the changed set, and present the revised review and checkpoint again. A reply that both requests a change and says to proceed changes the requirement first and does not advance until the revised review is settled. Start no council, second opinion, design, or drafting before this checkpoint and the later plan choice are complete.

   **Choose the drafting plan after the implications are settled.** Assess the six Stage 7 signals against the settled set, then select the recommended plan. Reassess after any decision is reopened and reviewed again. The recommendation follows this precedence:

   - **Review before the design** when evidence leaves multiple approaches unresolved, a criterion has no obvious implementation path, there is no codebase precedent, or research found competing approaches without a winner (signals 1, 2, 4, and 6).
   - **Otherwise, review after the design** when a criterion conflicts with another criterion or an NFR, ratification materially changed the problem, or the implications review was material, meaning it emitted at least one category (signals 3 and 5, or a material review).
   - **Otherwise, no council.**

   An implications review that was unavailable counts as unavailable, not as material or immaterial.

   **Select the after-design tool.** For an after-design review, use `request_council` whenever a tension signal fires or the implications review was material. Otherwise use `second_opinion` only when the review reduces to exactly one or two separately answerable questions, with at most two calls and 10 credits. Use `request_council` for every other after-design scope.

   **Record the plan in working state before anything is shown or run.**

   ```text
   drafting_plan:
     council_choice: before | after | none
     review_tool: request_council | second_opinion    # only when council_choice is after
     review_scope: what the review covers
     review_questions: each concrete question with the current answer or an explicit uncertainty
     gap_check_policy: run_if_epic | skip
   ```

   Record the review scope and questions with the tool selection before any review executes, so the disclosed estimate and the later execution agree. `run_if_epic` is the recommended gap-check policy in every attended plan; `skip` stays an explicit alternative. Also keep the legacy attended `council_choice` that Stage 9 passes to the gap check: `approved` for `before` and `after`, `declined` for `none`.

   **The drafting plan is the optional-check choice surface after the implications checkpoint.** Show it in every attended run after the implications are settled, in a separate turn. There is no case where it is omitted and an omitted plan counts as a decline. Write it in plain language. Never put the words "trigger", "Stage 6", "create gate", "pre-approve", or "coherence" in what the user reads. Emit it in this shape:

   ```text
   Your requirements are settled. Here is my plan for the rest of the run, so you decide every optional check once.

   Recommended plan: {the recommended option, by number and name}
   Why: {one or two sentences naming the evidence behind the recommendation}

   Questions a review would check, with my current answer:
   - {concrete question, naming the criteria at issue}: {my current answer, or "I'm not sure"}

   Your options:
   1. Review before the design (as recommended) - {the council's scope}. If this becomes an epic, I'll also run a gap check on how the tickets are split. Then I'll draft every ticket and ask once before uploading. About {remaining time}.
   2. Review after the design - {a council or a second opinion, and its scope}. If this becomes an epic, I'll also run a gap check on how the tickets are split. Then I'll draft every ticket and ask once before uploading. About {remaining time}.
   3. No council, your choice - I design from my own analysis. If this becomes an epic, I'll still run a gap check on how the tickets are split. Then I'll draft every ticket and ask once before uploading. About {remaining time}.
   4. Skip the gap check - combine this with 1, 2, or 3 to skip the gap check if this becomes an epic. It saves time only if the work becomes an epic.

   Faster: {the same plan under the same assumptions, with the slowest planned review removed, and how much sooner that is}
   Whichever council option you pick also covers a review of how the tickets are split if the work becomes a high-risk epic, so I won't ask again.
   These estimates assume {ticket shape, ticket count, design effort, reviewer rounds, and whether drafts can run in parallel}. Expected review credits: {the review credits for that option}. Possible extra charges: {an additional council, or the retry from a technical council to a general one}. Writer and reviewer credits are unknown, so there is no all-inclusive total.

   To change a requirement instead, just tell me which one.
   ```

   Put `(as recommended)` on the recommended option only and on no other; the example above shows it on option 1 for shape only. Every option shows its approximate remaining end-to-end time under the shared assumptions named in the plan. The faster alternative explains that removing a planned review is faster, and that skipping the conditional gap check is faster only if the work becomes an epic. When the recommended plan is already no council, say that it is **already the fastest available path**, and that skipping the gap check is faster only if the work becomes an epic. That is the sole exception to naming a faster alternative.

   **Static guidance for the estimates.** Use this table and no other source for time and credits. It is **rough, static guidance - not measured duration or usage**. Label writer, reviewer, and every other unspecified credit cost as unknown, and never present an all-inclusive credit total. Separate the expected review credits from possible additional council charges and from the existing technical-to-general retry.

   | Step | Rough time | Rough credits |
   | --- | --- | --- |
   | Council before the design, or after the design with `request_council` | about 15 minutes | 26 credits for standard models to 65 for frontier models |
   | `second_opinion` | a few minutes per question | 5 credits per question, at most two questions |
   | Gap check (epic only) | a few minutes per reviewer round: up to two ordinary rounds for a low-risk epic or three for a high-risk one, plus any confirmation passes | unknown |
   | Gap-check councils (epic only) | an initial high-risk council and at most one additional qualifying council, each about 15 minutes | 26-65 credits each |
   | Parallel writer pass | about as long as the slowest single draft | unknown |
   | Upload | about one minute per ticket | unknown |

   The credit range is the design council's own price for standard and frontier models, from `request_council` pricing in `api/library/billing/pricing.py`; the `second_opinion` fee is 5 credits.

   **Reading the reply.** Judge the reply by intent. Do not match exact words or normalize tokens.
   - A clear numbered choice, a clear verbal choice, or an explicitly named mixture such as "review after the design, skip the gap check" applies that plan. Read option 4 as a modifier on whichever council option is named.
   - A clear "use the recommendation" or "continue as recommended" selects the recommended plan, including its gap-check policy. A reply that does not identify a plan, such as a bare "go ahead", authorizes nothing.
   - An unclear reply authorizes nothing. Say what you could not tell and show the same plan again. Start no council, no second opinion, and no drafting pass from it.
   - **A requirement change comes first.** A reply that picks a plan and also changes a requirement reopens that requirement. Re-settle it in chat, record the new override, rerun the entire implications review against the changed settled set, present the revised review and implications checkpoint, then reassess and show the resulting plan only after the user settles those implications. Run nothing from the mixed reply. A named decision supersedes an earlier choice.
   - **A new focus for a chosen review.** If the reply clearly selects a review and names only a new focus for it, echo it as a revised checklist in one or two lines, update `review_scope` and `review_questions`, and move on without another ordinary stop. If the reply asks a question, answer it first, then show the plan again in a compact form.
   - Keep only the final `drafting_plan` and its legacy `council_choice` in working state.

   **Short-path presentation (attended only).** When `run_path` is `short`, the sentences above that require the implications checkpoint, the plan, and their replies to be separate turns describe the full path, and this paragraph replaces them. After requirements and ticket scope are settled, with every `ask` resolved and every override applied, present the implications review and the recommended drafting plan together in one message. Use the same review and the same recommended plan, in the plan's usual shape, and drop neither. Do not add the checkpoint question; the combined message replaces it.
   - **Normal continuation.** Proceed directly to Stage 7 and Stage 8 (design and drafting) without asking the owner to acknowledge the message. The owner can still object in any reply, and you judge that reply by intent: a requirement change is handled first, as under "A requirement change comes first".
   - **Exceptional stops.** Stop and wait, as the full path would, in exactly these two cases. (a) The review identifies a decision that only the owner can make. This is not a closed list: use judgment, and treat a requirement change, a newly found forced-full area, or a change of ticket scope beyond 1-2 tickets as examples. A plain ticket-count correction within 1-2 tickets is not, by itself, an owner-only decision. (b) The recommended plan includes a council or a second opinion. Both are paid reviews, billed to the account.
   - **An exceptional stop does not promote the run to the full path.** Resolve the decision or the paid-review question in that stop, then continue on the short path to design and drafting. Do not add the separate full-path checkpoint turns. Only a trigger under Switch to the full path changes the path.
   - **Paid reviews need explicit approval.** Approve a council or a second opinion separately from resolving the implications. A reply authorizes only what it explicitly addresses: "looks right" settles the implications and authorizes no paid review, and a plan choice settles the plan and does not settle an open decision. An unclear reply authorizes nothing, so say what you could not tell and show the question again.
   - **Unchanged on the short path.** Keep the unavailable-review rule, the plan's static estimates, and the doc updates in item 6. Shorten nothing about the review's three categories.

   Literal `auto_approve = true` emits the review, records the recommended plan, and skips showing the plan entirely; a missing or non-true `auto_approve` value follows the human-in-the-loop path above.

6. **Settle the criteria and update the doc.** Rewrite the Acceptance Criteria, Goals & NFRs, and Open Questions sections of `{docs_dir}/explorations/{slug}.md` to the agreed set: fold in every correction, resolve each answered requirement question into the criterion it affects, promote settled criteria out of `open`, and weave `general_comment` in as overarching guidance. Add or update the `## Implications` section with the latest review from item 5 — the final one after any reopen/review loop — or its one-line unavailable notice if generation was unavailable. Also record the selected drafting plan and its review scope under the doc's requirements sections. For attended runs, update `## Ticket Scope` with the agreed `ticket_scope` count, rationale, and approximate responsibilities; preserve it in all later document rewrites, and preserve the `## Run timing` section the same way. Set the doc's Status line to "Requirements ratified". Preserve all unaffected sections unchanged. **The settled criteria are now the contract** — every later stage is judged against them.

**Switch to the full path (attended only).** This is the one authoritative rule for leaving the short path. Later stages refer to it. It is one-way: a full-path run never returns to short. It never applies under `--auto`.
- **Triggers.** Any one of these: the owner asks for the full path (for example "full path" in any reply); the work needs three or more implementation slices, including an agreed `SCOPE-1` count of at least three; a forced-full area is newly discovered; a writer reports a behavior change; or the owner widens the scope.
- **When to check.** On every owner reply; after the design and the split; whenever a writer returns; and before the upload gate.
- **On a switch.** Announce it in one line that names the trigger. Set `run_path` to `full` and `escalated` to `true`, and add the trigger to the doc's `## Context`. Keep the research, the exploration document, the ratified requirement set, and every existing draft.
- **Completed-stops checklist.** Keep a small `full_path_stops_done` list in working state of the full-path stops that were validly completed as separate stops. The combined short-path message completes neither the implications checkpoint nor the drafting-plan stop, although you reuse its content. After a switch, run the missing implications checkpoint and drafting-plan stop separately, as the full path describes. If the work becomes an epic, follow the existing epic flow, including the gap check, before any writer for the epic runs. **Epic procedure loading.** The three-or-more-slices trigger does not load the epic hand-off procedure by itself. An early switch, including an agreed `SCOPE-1` count of at least three in this stage, changes the attended path immediately but defers loading until Stage 9 freezes the epic split. A switch that happens inside Stage 9 after the split froze enters the single "Load the epic hand-off procedure" block there immediately before the first epic operation, unless the procedure was already read. The procedure is read at most once per run, and this rule adds no second lookup.
- **Requirements and drafts.** A changed requirement goes back through Stages 5 and 6 and then the design flow. Do not regenerate the requirements page for an unchanged requirement set. Keep existing drafts on a late switch, and redraft only the affected entries under Handling changes. Choosing a paid review does not, by itself, invalidate unaffected drafts.
- **Reminders.** At Stage 6, at the Stage 8 split, when a writer returns, and at the upload gate, apply this check again in one line.

This stage is non-blocking: if the user never commits, leave the doc as written in Stage 4, tell them the requirements are unratified, and stop without forcing a decision. Do not proceed to a council or a design on unratified criteria.

## Stage 7 — Council Gate

The criteria are ratified, and Stage 6 already recorded `drafting_plan`. This stage only **executes** a before-design council. It asks the operator nothing.

**Entry safeguard.** If a Stage 5 fallback (the requirements page could not be generated and the user confirmed the criteria in chat) reached this stage without Stage 6 item 5, run the implications assessment and the attended implications checkpoint before the drafting-plan selection from Stage 6 item 5. Under `--auto`, keep both prompts skipped. On the short path, run that assessment and show the review and the plan together as Stage 6 item 5's short-path presentation describes, rather than as two separate stops. Do not edit Stage 5 and do not generate another requirements page.

The six signals are assessed in Stage 6 after the implications are settled and before the plan is shown. A council is cheap relative to committing the user to the wrong design.

1. **The six signals.** A signal fires when **any** of these hold:
   - More than one materially different approach could satisfy a criterion, and the codebase evidence you gathered cannot separate them.
   - A criterion has no obvious implementation path in the existing code.
   - Meeting one criterion appears to trade off against another criterion or against an NFR (any tension noted in Stage 3 step 6, or created by a correction in Stage 6).
   - The work touches an area with no established pattern — Stage 1 found no precedent to follow.
   - Ratification materially changed the problem — the user tightened a bound, rejected a criterion, or added an obligation you had not framed.
   - Stage 2 research surfaced competing approaches with no clear winner.

   No signal fires when every ratified criterion maps cleanly onto a well-trodden pattern already used in this codebase and you can point to the precedent.

2. **Run only on the recorded plan.** Run the council here only when `drafting_plan.council_choice == before`. When it is `after`, defer the review to Stage 8, once the design and sized slices exist. When it is `none`, an unclear reply left the plan unresolved, or a requirement was reopened and not re-settled, run no council here: go to Stage 8 on your own analysis. Never run a council without that recorded choice. Stage 7 asks the operator nothing.

   **Only under --auto:** execute the deterministic plan recorded by Stage 6, with no question. For `before`, first state the council cost and the approximately 15-minute poll, then call `request_council`. For `after`, state nothing here: Stage 8 runs it and states its cost before the paid call. For `none`, run no council. The task description names the criteria as proposed, unratified.

3. **Execute.** Call `request_council` with:
   - `task_description`: the task, the **ratified** acceptance criteria and NFRs from Stage 6, the specific uncertainty you summarized, and the recorded questions from `drafting_plan` (as revised by the user, if they were). Sent verbatim — this tool does not read from a file. State plainly that the criteria are settled and the council's job is to find how to meet them, not to revisit what they are. Its scope is "how, not what".
   - `mode`: `technical`.
   - `wait_for_result`: `true`. `save_locally`: `true`.

   While it runs, tell the user it is polling and roughly how long it may take (about 15 minutes, as disclosed in the plan).

4. **Fold the result into your analysis.** Carry the council's approaches, objections, and any option you had not considered into Stage 8. If the council argues a ratified criterion is unmeetable, do not silently drop it — raise it with the user in Stage 8 as an explicit conflict.

If the council fails or times out, note the failure visibly and proceed with your own analysis — a missing council degrades the design but does not invalidate it. This stage is non-blocking — always proceed to Stage 8.

## Stage 8 — Propose Final Design

Now describe how you would build it. A review the drafting plan scheduled for after the design runs in item 4. **Do not generate a decision page for this stage.** The requirements page was the user's decision surface; the design is your proposal, written into the doc and discussed in chat. Generating a second page here would ask the user to ratify a solution, which is not what this command does.

1. **Work out the design against the ratified criteria.** Consider the approaches you know plus anything the council surfaced. For each candidate, establish which criteria it satisfies and at what cost. An approach that cannot meet a ratified criterion is not a candidate — discard it and say why.

2. **Resolve any tension explicitly.** Where meeting one criterion costs another, or costs an NFR, state which obligation your design privileges and what that costs the other. Do not let a tension pass silently.

3. **Commit to a single proposed design.** You are recommending, not offering a menu. Name the approach, describe how it works, list the files to create or modify, and map each ratified criterion to the part of the design that satisfies it. Where you seriously considered an alternative, record it and why you rejected it — as history, not as an open choice.

   **State how SFCC browser checks are verified.** For a Salesforce B2C Commerce repository, `## Criteria Coverage` states how each browser-checked criterion is verified. When an approved SFCC sandbox is configured, in any mode, changed cartridge files are uploaded first with `epic-implementer epic-server sfcc-upload`. The check then runs through the local dev server in `local` mode, or on the shared sandbox storefront in `sfcc_shared_active`. Storefront Next React-only changes need no upload and are checked through the local dev server in `local` mode. In `none` or `unknown` mode, the verification is a visible recorded hand-off. Never claim the sandbox storefront proves React-only changes. When a needed sandbox capability is unavailable, follow the ticket writer's rule for a requirement that defers what a criterion needs, and add no new prerequisite or stop. Never design a verification around a whole-cartridge upload, a Managed Runtime (MRT) push, a per-ticket code version, a code-version switch, or the repository deploy workflow.

   **Honor the agreed ticket count (attended only).** Build the design's implementation slices to match `ticket_scope`, preserving full requirements coverage and the existing sizing guidance. If design or a later review reveals that a different count is necessary, explain the coverage or sizing reason, recommend the revised count and responsibilities, and obtain explicit agreement before drafting or redrafting. Update `ticket_scope` and `## Ticket Scope`, rerun the implications review and its confirmation for the changed scope, and refresh any affected drafting-plan estimates. Do not silently change the count or force an unsafe split to satisfy it. Under `--auto`, no attended count or scope confirmation applies.

   The plain-count-correction carve-out in Stage 6 item 5 only decides whether the combined short-path message stops. It never substitutes for explicit agreement to a changed count: a changed `ticket_scope` still needs the explicit agreement described above, whichever path the run is on.

   **Check the path after the split (attended only).** After the design and its slices are recorded, re-evaluate the Switch to the full path triggers in Stage 6, in one line: three or more slices, a newly discovered forced-full area, or any other trigger switches the run before Stage 9 freezes the split.

   **Record the implementation slices with a size band.** The design's sequence of work is also the proposed ticket split, so name each slice and size it with the ladder in the posture block below — `S` / `M` / `L` / `XL`, by file-touch breadth and rough LOC. Size the slices here, in the design, rather than at the handoff gate: the split is a design decision, and deciding it under the pressure of an approval prompt is how a coherent design turns into a swarm of tiny tickets. A slice that will not fit in `L` becomes one `XL` slice — do not split it to fit a band. Split only when it is genuinely two independent pieces of work, or when it runs past roughly 40 files / ~3000 LOC.

4. **Run the planned after-design review.** Run this only when `drafting_plan.council_choice == after`; otherwise skip it. It runs after the design and its sized slices are written, and before Stage 9 freezes the split. State the cost before the paid call, and again before any billable expansion. Use the tool and scope already recorded in `drafting_plan`.
   - **`request_council`:** call it with `mode: technical`, `wait_for_result: true`, and `save_locally: true`. Send the finished design, its slices, the unchanged ratified requirements, and the recorded questions in `task_description`, verbatim, with the scope "how, not what".
   - **`second_opinion`:** make one call per recorded question, at most two calls and 10 credits. Each call sends a self-contained `prompt` holding the finished design, its slices, the unchanged requirements, and that one question, with a `model` tier and a `provider` family different from the one you run on. The reply text is returned synchronously.
   - **Fold usable findings** into both the proposed design and the affected slices, then update the coverage and the exploration document before you proceed.
   - **A finding that a ratified criterion is unmeetable** is never resolved by weakening the criterion. Attended: raise it with the user as an explicit conflict and resolve it before Stage 9. **Only under --auto:** halt before any writer or `create_ticket` call as `open_requirements`, listing the criterion in `open_items` and explaining the review-derived cause in prose. The halt-reason list does not change.
   - **A review that fails** (a tool error, an explicit failure or timeout state, or unusable output) is noted visibly. Continue on your own design. Never claim the review completed and never substitute another paid review. Record the affected scope and the follow-up in attended progress, in the exploration document, in the upload outline, and in the Final Report; under `--auto`, address the notice to the invoking operator or `/idea-to-pr` consumer through the existing artifacts and report prose.
   - A review failure never relaxes criterion coverage, readiness, or epic clearance.

5. **Rewrite `{docs_dir}/explorations/{slug}.md`** so it reads as a finished proposal, not a mechanical append. Set the Status line to "Design proposed". Keep the ratified Acceptance Criteria, Goals & NFRs, and `## Implications` sections intact — they are the contract and must not drift — and keep the `## Run timing` section, and the Context's path record, intact too. Then add:

```markdown
## Approaches Considered

{Each candidate, what it would mean, and why it was or was not chosen. Note which came from the council, if one ran. If no alternatives were seriously considered, state that and why the path was obvious.}

## Proposed Design

{The recommended approach in enough detail to implement: how it works, the files to create or modify, the sequence of work, and the risks. Reference specific files with file_path:line_number format.}

## Criteria Coverage

{Each ratified criterion mapped to the part of the design that satisfies it, and how it will be verified. Any criterion the design only partially meets must say so plainly.}
```

6. **Present the design in chat and invite pushback.** Summarize the proposal in at most six bullets — the approach, the files it creates or modifies, the order of the work, and any ratified criterion the design only partially meets — and state clearly that it is a proposal. If the user objects, revise the design — but if their objection actually changes what the system must do rather than how it is built, say so: that is a criteria change, and it means reopening the criteria rather than quietly bending the design around it.

This stage is non-blocking — always proceed to Stage 9 once the design is written and summarized in chat, even if the user has not responded to it. The invitation in item 6 is not a question: do not stop and wait for a reply. The user can still object at the Stage 9 upload gate.

**Only under --auto:** the invitation for design pushback in item 6 is output-only. Do not wait for a reply.

## Stage 9 — Ticket Handoff

<!-- BEGIN BRIDGE TICKET-AUTHORING POSTURE -->
<!-- Canonical source: docs/bridge-ticket-authoring.md.
     This block is duplicated byte-identically onto every carrier. Never edit a
     copy: edit the canonical source and re-copy it verbatim. A cross-surface
     byte-equality test fails the build if any copy drifts by a single byte. -->

## Ticket-authoring posture

Deep reference: `docs/bridge-ticket-authoring.md`.

**Draft through the writer.** Every ticket body — an epic parent, an epic child,
and an ordinary sibling alike — is drafted by the `jira-ticket-writer` agent
before `create_ticket` is called. Do not compose a ticket description inline.

**Size the work.** Size each ticket by file-touch breadth and depth plus rough
lines of code (LOC) changed:

- `S = 1-2 files / <~80 LOC`
- `M = ~3-8 files / ~80-400 LOC`
- `L = ~8-15 files / ~400-900 LOC`
- `XL = >15 files / >~900 LOC`

Target size priority: **L (target) -> XL (when the work does not fit in L) -> M
(third choice) -> S (only when unavoidable)**. This applies equally to a
standalone ticket and to an epic child.

Aim each slice at L. When one will not fit, grow it to XL rather than splitting
it — split only when the slice is genuinely two independent pieces of work,
never merely to land inside a band. Bridge's grooming and implementation process
handles a large vertical slice well and is overkill on small ones: every extra
ticket is another worktree, another PR, another rebase, and another chance for
two workers to touch the same file. Reach for M because the work genuinely is
that size, not to avoid an XL.

Beyond roughly 40 files or ~3000 LOC, split anyway. Past that point review
turnaround and rebase cost dominate the run's budget, and a review that wedges
holds the gate to its full retry ceiling before anyone notices.

**Group at three.** Three or more implementable tickets is an epic: propose an
epic parent plus an ordered child manifest, and resolve this surface's own
approval gate before anything is created. One or two tickets are ordinary
siblings — no epic parent, no manifest. The threshold is exactly three.

**Hand off once.** An epic handoff names exactly one conductor entry point,
`drive-epic`, which selects the runnable path itself. Never present a choice
between conductors.

**Departure is closed-list only.** These three exceptions, and no others, permit
departing from the rules above. Invoking one requires no announcement.

- **E1 External-tracker mirroring** — a recorded upstream identifier exists and
  its granularity is contractual. Bypasses sizing and the epic threshold.
- **E2 Discovery-only spike** — no committed production-code deliverable.
  Bypasses sizing only; does not bypass drafting through the writer.
- **E3 Authorized incident containment** — tied to an active incident record,
  not to schedule pressure. Bypasses sizing and the epic threshold.

The list is closed. Anything outside it is an escalation to the operator, not a
judgement call. Explicitly refused as grounds for departure: a single-file
trivial fix (that is `S` reached through the normal path, not an exception),
generic time pressure, "already well specified", "faster without the writer",
developer discretion, minor refactor, unattended mode, context limits, and "hard
to decompose" (XL is the normal overflow, so that is the ordinary path and not a
departure). Writer unavailability escalates; it never silently authorizes inline
drafting.

<!-- END BRIDGE TICKET-AUTHORING POSTURE -->

1. **Assess readiness.** The work is ready to become a ticket when the criteria are ratified, the design is proposed, and no criterion is left unresolved or only partially covered. If something is still open, say what it is and recommend the follow-up that would close it rather than creating a ticket on a soft foundation:
   - A **wider council** (`request_council`) when the design would benefit from a broad review before implementation. If Stage 7 or Stage 8 already ran one, only suggest another when something material changed since.
   - A **second opinion** (`second_opinion`) when a few specific contested points need an independent check.
   - **Web or deep research** (`request_deep_research`) when the design still rests on technical unknowns that need grounding.

   **Only under --auto:** do not pause or halt on these recommendations. Write each one as a `Readiness follow-ups` line in the Final Report. They are not `open` requirements, which halt earlier. Auto-mode readiness and every later reference to the criteria use the **proposed, unratified** set, never a settled or ratified one.

2. **Decompose once, check the split, draft every entry, then ask once to upload.** When the work is ready, freeze the split before you draft, and show the whole thing at the upload gate. Never present the gate bare — the user cannot consent to a plan they have not been shown.

   **The order is fixed:** design and split, including any after-design review; the frozen-manifest gap check, when it applies; the writer drafts; then the final attended upload approval. A gap check never runs after drafting.

   **Late escalation (attended only).** If a Switch to the full path trigger fires after drafts exist and the work becomes an epic, the gap check for the new epic manifest still runs before any further writer work for the affected entries. Drafts retained from the earlier sibling flow are kept, not discarded, and are redrafted only where the new manifest or Handling changes make them affected. This qualifies the fixed order for that case only.

   Count the implementation slices Stage 8 recorded. In attended runs, require that count to equal the agreed `ticket_scope` count before freezing the split. That count decides the shape, and the threshold is exactly three:

   - **Three or more slices → propose an epic.** Freeze an epic parent plus an ordered child manifest in one pass. Per child: title, scope boundary, size band, `depends_on` (hard prerequisites that must land first), `recommended_after` (soft sequencing preferences that are not blockers), a one-line order rationale, and `owns_verifications`. `owns_verifications` is a list of `{epic_ac, obligation}` entries, exactly as `review-epic-coherence.md` defines the field: `epic_ac` is a ratified criterion id, and `obligation` is the concrete part of that criterion's verification sentence this child will carry out. Fill it in now, in the same pass that freezes the split. When the ratified design assigns an epic criterion's verification to a concrete **owner-run** step — for example a release-checklist step a person runs outside the Epic Implementer — do not force a child to own it: declare a `non_child_owners` entry instead, with `id` (for example `OR-1`, never a child id), `kind` (`owner_run`), `who`, `step_ref`, `step_text` (copied verbatim from the design), `records_result_in`, and `owns_verifications`. That obligation never goes into a child's acceptance criteria. Keep hard prerequisites strictly separate from soft sequencing. A child may be `XL`; grow one rather than splitting it to fit, and split only past roughly 40 files / ~3000 LOC.
   - **One or two slices → ordinary siblings.** No epic parent, no manifest, no decomposition pass. Just the ticket or the pair. **Siblings run no epic coherence check**: no reviewer call, no record, no extra outline line, and no extra prompt. The residual risk — a pair that really needed a set-level check — is contained by the existing gates: step 3 creates only the set shown at the upload gate, and every body is drafted by the writer. If the work is really epic-shaped, tell the user so and regroup it as an epic before creation. Attended runs have one allowed addition for exactly two ordinary siblings, the main-agent overlap check in step 3. It is not an epic coherence check, and it is the only extra sibling outline line.

   This decomposition is the **single authoritative split** for the rest of the stage. It is decided here, once, with the whole portfolio in view; step 3 renders bodies against it and does not revisit it.

   **Only under --auto:** immediately after the split freezes, and before writing `epic-manifest.json`, count the implementable epic children or siblings. If the count is above the resolved `--max-children` cap, halt as `max_children` with both counts and a "split first" message. Never truncate the split. Apply the same cap again if an unattended coherence amendment re-freezes a changed split, before writing its replacement manifest or going further toward creation. Just before any writer or ticket-creation call, re-check for `open` acceptance criteria or NFRs and halt as `open_requirements` if any remain.

   **Load the epic hand-off procedure (epic only, once).** Only now, with an epic split frozen and the `--max-children` guard above passed, read the epic hand-off procedure at `.bridge/procedures/define-tickets-epic-handoff-procedure.md` in this project, where the Bridge installer scaffolds it. Only if that file does not exist, read `mcp_server/instructions/define-tickets-epic-handoff.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. Read it once per run, then follow it at each epic-only pointer in this stage. This adds no flag, no state file, and no separate entry point. A sibling run never reads it: a run that never froze an epic does not read the procedure, not during exploration and not for a split that stays at one or two slices. If a frozen epic is later revised down to one or two slices, keep the earlier read, follow the sibling path, and skip the epic-only sections without rereading. A switch to the full path that makes the work an epic (see Switch to the full path in Stage 6) enters this same load block immediately before the first epic operation, unless the procedure was already read. If the procedure cannot be read or is in neither location, stop; never rebuild the epic instructions from memory. Attended: stop with the repair guidance below. Under `--auto`: halt as `stage_failed` naming Stage 9, adding no halt reason and no terminal field.

At this procedure-read failure, retain the source-checkout fallback and the stage's existing refusal or optional warning/skip behavior. Name the exact `.bridge/procedures/define-tickets-epic-handoff-procedure.md` procedure and affected stage/keys. On Linux, from the established project root, run `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <claude|cursor|codex|copilot>` in a terminal (quote the root for the shell). On macOS and Windows, in-place repair is unsupported: re-run start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds. Repair fills missing packaged files only; resolve permission/non-file/unsafe-link problems separately. Refresh/reconnect, reread that same procedure, and resume only if the original stage allows it. Do not repair customer instruction overrides.

   **Epic gap check (epic only).** Follow "Step 2 — Epic gap check (frozen manifest)" in the epic hand-off procedure, before any writer runs. Siblings skip this.

   **Coherence procedure lookup.** The epic hand-off procedure's Step 2 requests this lookup when it runs a gap check; read nothing here otherwise. Read the procedure at `.bridge/procedures/review-epic-coherence-procedure.md` in this project, where the Bridge installer scaffolds it. Only if that file does not exist, read `docs/install/review-epic-coherence-procedure.md`; only if that file does not exist either, read `mcp_server/instructions/review-epic-coherence.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. If it is unreadable or none of the three exists, stop: the shared procedure is not usable, so use the fill-only terminal repair guidance below. Never improvise a substitute review.

At this procedure-read failure, retain the source-checkout fallback and the stage's existing refusal or optional warning/skip behavior. Name the exact `.bridge/procedures/review-epic-coherence-procedure.md` procedure and affected stage/keys. On Linux, from the established project root, run `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <claude|cursor|codex|copilot>` in a terminal (quote the root for the shell). On macOS and Windows, in-place repair is unsupported: re-run start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds. Repair fills missing packaged files only; resolve permission/non-file/unsafe-link problems separately. Refresh/reconnect, reread that same procedure, and resume only if the original stage allows it. Do not repair customer instruction overrides.


3. **Draft every entry, ask once to upload, then create.** Nothing calls `create_ticket` before the upload gate below resolves with an explicit affirmative, and no entry is drafted before the split is frozen and any planned gap check has run.

   **Only under --auto:** there is no upload gate. Clearance of every auto gate and draft completeness replace the affirmative, for siblings and an epic alike, and the upload prompt is never shown.

   **Check the record before any writer (epic only).** Follow "Step 3 — Record check and full clearance" in the epic hand-off procedure before any writer runs (and, under `--auto`, full clearance before any writer; before the first `create_ticket` call in every run). Siblings skip this.


   Fan out **one `jira-ticket-writer` invocation per entry** in the frozen outline — the epic parent, each child, and each ordinary sibling. Each invocation is bound to exactly its own entry and renders a body against that entry's fixed boundary and size band. A child invocation must not re-split, merge, reorder, renumber, or rescope: the decomposition is already frozen, and an invocation that sees one entry is deciding on strictly less information than the pass that saw them all.
   For every epic child, pass its carried ticket-local findings beside `owns_verifications`, word for word. Before creation, require that child's draft to contain each carried finding id, evidence, and smallest amendment verbatim; fail closed if any is dropped.

   **Launch every writer at once.** First check whether the host can run subagents in parallel. If it can, launch every per-entry invocation at once, in parallel, as separate agent calls in a single host message. If it cannot, run them one after another with identical frozen entries, inputs, and output paths. Sequential execution is progress, not a stop: say that the parallel estimate no longer applies, give a revised rough duration, and record the fallback in the exploration document and the Final Report. Never relaunch an invocation that already started when a fallback or a partial launch failure occurs. Never draft inline. Take a host-clock reading at each writer's launch and finish, and when each writer returns, re-evaluate the Switch to the full path triggers (attended only). A selective retry or a revision call also gets a research packet and its own timing attempt.

   For the epic parent, pass the prospective verdict and proposals together: the verdict `accepted_with_gaps` when proposed acceptances exist, the exact proposed overrides with their reasons, the existing recorded overrides, and the record's coverage map.

   Pass into every invocation, verbatim: the ratified acceptance criteria that entry satisfies, the proposed design for its slice, the entry's own manifest fields, and the doc's ratified `## Goals & NFRs` section — the business goal, desired end-state, system behavior, and every NFR with its requirement and implication. Pass the whole section to every entry, not a subset you picked: the writer decides which NFRs bear on its entry, and an NFR whose implication applies to every ticket (for example "each ticket carries a producer-and-exit table") is lost if it reaches only the parent. Do not restate or reinterpret the criteria or the NFRs — they were ratified in that wording, and they go to the writer unchanged. For an epic, also pass:
   - to each **child** invocation, that child's `owns_verifications` entries, word for word. The draft's acceptance criteria must keep each obligation verbatim, so the created child still carries the evidence that was reviewed. Check each child draft for this before the upload gate;
   - to the **parent** invocation, the record's coverage map — taken from the record, including each owner-run owner with its person or role and step reference — its exact verdict, and every override with its recorded reason, for the parent's `## Epic coverage map` section. Owner-run obligations go to the parent's map only, never to a child invocation.

   **Research packet (both modes, every invocation).** Every writer invocation includes a `Research packet` block: the parent, each child, each sibling, and every retry and revision call. Build each packet from the Stage 1 findings, mapped to that entry's Stage 8 slice. It holds the `path:line` references for the files that slice touches and why each matters, the relevant callers and tests, and the known risks. Every packet also holds the shared precedent, the global risks, and the repository and branch the findings came from. When you are unsure whether a finding bears on an entry, include it. The packet is added to the inputs above and replaces none of them: the verbatim criteria, Goals & NFRs, manifest fields, ownership obligations, carried findings, output paths, and automation-specific inputs all still go in unchanged. Tell the writer that the code is the source of truth and the packet is a navigation aid, and that it must report a scope or behavior contradiction back to you rather than rescope or modify the frozen entry.

   **When a writer reports a contradiction.** Attended: the report is a Switch to the full path trigger when it shows a behavior change, and otherwise you resolve it with the owner as a wording or boundary change under Handling changes. Never rescope a frozen entry yourself. **Only under --auto:** absorb a factual citation or line-number correction and continue; halt an unmeetable ratified obligation as `open_requirements`, but only when a draft exists and its report is a valid non-empty block; keep `stage_failed` for a writer that cannot produce its draft (it stops without a draft), and carry that writer's questions in the failure reason. This adds no halt reason and no pause.

   **Only under --auto:** pass into **each** `jira-ticket-writer` invocation, whether epic parent, child, or sibling, the applicable `comp-analysis.json` path when it records `applicable: true`, the project-standards result or a `standards unavailable` note, and an instruction to label its criteria `proposed, unratified`. Keep the entry's criteria and manifest obligations verbatim. A degraded comp is never described as reviewed, and tickets are never described as standards-checked when standards were unavailable. A writer failure or any other critical failure before the first `create_ticket` call is a `stage_failed` halt.

   **Give every writer invocation an explicit draft path, and record it for that entry.** Without one the writer falls back to its own default location and the command never learns the path, which the materials pass below needs. Use one draft directory per run: attended, `{docs_dir}/explorations/{slug}-drafts/`; under `--auto`, `{docs_dir}/explorations/{slug}-{run_id}/drafts/` (the artifact directory Stage 0 step 5 creates). Use fixed file names so a file maps to its entry: `parent.md`, `child-{N}.md` (`{N}` is the 1-based manifest position), and `sibling-{N}.md`. A draft file that is missing after a writer run is a writer failure; under `--auto` that is the `stage_failed` halt above.

   **Require the terminal writer report on every invocation.** Every writer invocation, whether the initial call, a retry, or a revision, must end its reply with the writer's `open-questions` report, after the draft path. The contract is:

   > Exactly one fenced code block with info string `open-questions` must end the writer's reply, with no trailing prose. Its content is either the literal `none` alone or one entry per unsettled choice in the form `- question: … / why it blocks: … / options: …`, with all three fields non-empty. Empty, duplicate, mixed, incomplete, or non-terminal blocks are malformed. Missing or malformed blocks require writer revision and never mean "settled." The block is reply-only and never belongs in the ticket body.

   The report is reply-only. Never copy it into a draft or a Jira body.

   **Check every draft before the gate.** Every expected draft must exist at its assigned path and satisfy the verbatim obligation and carried-finding checks above before the upload gate can appear. Validate each writer's reply alongside those checks: it must end with exactly one valid terminal `open-questions` block. A missing or malformed block gets exactly one writer revision, using the same entry, assigned draft path, research packet, and every other invocation input. Reinvoke only the missing or failed writers, and use sequential retries if parallel retries fail. If attended completion remains impossible, stop with the local artifacts, the exploration document and the drafts directory, and show no upload gate. **Only under --auto:** unresolved failure halts as `stage_failed` before any Jira creation, naming Stage 9 and the affected entry. A report that is still invalid after its one revision follows this same writer-failure path.

   **Resolve open writer questions (usable draft with a valid non-empty block).** A valid block that is not `none` means the draft exists but a choice is unsettled. This is not a writer failure.
   - **Attended.** Show the owner each affected ticket's question, why it blocks, and its options. Take the owner's answer. Re-invoke only the affected writer as a revision, passing the answer along with the entry, draft path, research packet, and existing inputs. Repeat with no cap. The owner may stop at any time through the existing owner-stop path, which keeps the local artifacts and shows no upload gate. Never offer to accept an unsettled draft manually. The upload gate stays absent until every writer's block is `none`.
   - **Only under --auto:** halt as `open_requirements` before any `create_ticket` call. Put every question in `open_items`, qualified by its entry (for example `child-2: {question}`). The halt-reason list does not change.

   **Normalize the epic parent's manifest section (epic only, automatic, no stop).** Ask the epic-parent writer for exactly this section, a peer-level `##` heading:

   ```markdown
   ## Ordered child manifest

   - pending: child keys are written here after the children are created.
   ```

   Then, before the upload gate, normalize the local parent draft (`parent.md`) yourself so it holds exactly one canonical `## Ordered child manifest` section with that fixed pending line. A manifest-section span runs from its heading through the line before the next `#` or `##` heading, or through the end of the body. Replace the first such span, remove every other manifest span (duplicates), and preserve every byte outside those spans. Place the normalized section immediately before `## Materials & Access`; when that heading is absent, append the section at the end of the body with a preceding blank line. The manifest stays a peer-level `##` section, so `## Materials & Access` remains the final major section when present. Normalization is idempotent: running it on an already-normalized draft changes nothing. It adds no approval, stop, owner question, or change to the frozen child split. The normalized local Markdown is the **parent Markdown source**: it is the initial parent body, and any later parent materials update advances the source to the last Markdown actually submitted for the parent. Fetched Jira text is never that source.

   **Open-decision phrase backstop (warning only).** After every writer revision and after the parent normalization above, scan each final local draft for phrases that read like a request to settle a decision. Do this before showing the attended upload gate and before any automatic `create_ticket` call. A validated `open-questions` block stays authoritative. A phrase match never halts, never hides the upload gate, and never refuses creation. The canonical list, from `docs/bridge-ticket-authoring.md`:

   <!-- BEGIN OPEN-DECISION PHRASES -->
   - must settle
   - settle this before
   - before planning
   - the caller must
   - owner confirms
   - owner must confirm
   - confirm with the owner
   - stop if not met
   - check the precondition first
   - TBD
   - to be decided
   <!-- END OPEN-DECISION PHRASES -->

   Matching semantics (warning only):
   - Match case-insensitively, as whole phrases with word boundaries.
   - Before scanning, drop fenced code blocks and `{noformat}` regions.
   - Report one warning per matching line, not one per phrase. Quote from the start of the sentence that holds the line's first match through the end of the line.
   - A phrase match is an advisory signal for a person to review. It never halts drafting, never hides an upload gate, and never refuses a launch.
   - Keep the full list out of routine reports. Report only the matching lines.

   Attended, show each match as a named item qualified by its entry, directly after item 9 of the outline below. Show the gate as usual when the writer reports are otherwise clear. Under `--auto`, add each match to the Final Report's **Warnings**. A phrase-only match does not halt or suppress creation.

   **Two-sibling overlap check (attended only).** When the shape is exactly two ordinary siblings, and after both drafts exist and pass the checks above, the main agent reads both finished drafts and assesses their scope boundaries, shared files, and criterion coverage. A shared file is a finding to assess; it is not automatic proof of overlap and not a reason to create an epic. Render exactly one outline line: `Overlap check: none`, or `Overlap check: {overlapping files, scope, or uncovered criteria}`. Recompute the line after any affected draft changes. This check adds no reviewer invocation, persisted record, extra prompt, or stop, and it never applies under `--auto` or to a lone ticket.

   Output the plan outline, kept to roughly one screen. For an epic, show it in this order:

   1. **Epic only, items 1–3.** Follow "Step 3 — Epic outline items 1–3" in the epic hand-off procedure (Gap check, Independence and notes, Who covers each requirement). Siblings skip them.
   4. **Plan** — the approach in one sentence.
   5. **Shape** — `epic` (with the parent's title) or `siblings`. Say which and why the count put it there.
   6. **Tickets ({n})** — one line per ticket: title, the slice of scope it covers, its size band, its ratified criterion ids, and — for an epic — its `depends_on` / `recommended_after` and order rationale. Say plainly when it is a single ticket.
   7. **Files** — the files to create or modify, grouped by area.
   8. **Sequence** — the ordered steps of the work, one line each.
   9. **Risks / not covered** — any criterion the design only partially meets, or `none`.
   9a. **Open-decision phrase warnings** — one named item per matching line, qualified by its entry (see the phrase backstop above), or omit when there are none. These are advisory and do not hide the gate.

   A sibling screen shows items 4 through 9 only: no gap-check sections. For exactly two attended siblings, it also shows the one overlap line from the check above.

   After the outline, also show the selected drafting-plan policies (council choice, review tool and scope when applicable, and gap-check policy), any review failure or sequential-writer fallback, and the path of every draft file.

   **Known gaps (epic only).** Follow "Step 3 — Known gaps (epic only)" in the epic hand-off procedure. Siblings skip this.

   Then close each approval attempt with exactly the applicable question. Substitute the actual number of drafts for `N`, and use the singular line when there is one draft:

   ```
   Upload these N drafts to Jira? (yes / change something)
   Upload this draft to Jira? (yes / change something)
   ```

   This is the only approval gate for irreversible creation. Show it once per approval attempt; it carries no council-consent question.

   Before you show the gate, re-evaluate the Switch to the full path triggers one last time (attended only) and apply any switch first.

   **Reading the reply.** Judge by intent, not by an exact token.
   - **Full path first (attended only).** Process a request for the "full path" in the reply before interpreting any upload authorization in the same reply. The switch comes first, nothing uploads from that reply, and you show the updated gate after the switch's missing stops complete.
   - **Clear authorization.** A reply such as "yes", "upload", or "go ahead" that plainly asks to upload the shown drafts and asks for no change authorizes uploading exactly the displayed draft set. It accepts every gap listed under `Known gaps that will be recorded on the epic`: record exactly the displayed proposed acceptances and reasons as overrides of kind `accept` with the `finding_id`, the shown reason, `accepted_by: "operator (agent-drafted reason)"`, and the `round`. The verdict becomes `accepted_with_gaps` only when every remaining foundation blocker has its required override. It never chooses a split change and never spends the fix budget.
   - **Creation stays blocked** while any foundation gap is not on that list. Never read a general yes as permission to change the split.
   - An unfinished required council still needs the existing typed acceptance that names its `council_id`, and "Couldn't check" still needs its separate typed bypass. A general upload approval never substitutes for either.
   - Asking to change the split, naming a finding, or asking a question opens a discussion or a fix and creates nothing.
   - If a proposed reason, target, verdict, or the parent's coverage changes, redraft the parent and show another gate. A changed shown set, or any other approval-relevant item, means the gate must be shown again; the earlier reply authorizes nothing.
   - An empty, negative, or ambiguous reply uploads nothing: do not guess intent. Report both the exploration document and the drafts directory as the artifacts, and tell the user they can later ask their agent to use the Jira Ticket Writer to revise those drafts or to create the tickets from them. A reply that mixes authorization with a change request also uploads nothing: make the change first, then show the updated gate. Creation is irreversible, so never create a ticket without a clear authorization.

   **Handling changes.** Distinguish what changed.
   - **A wording or boundary change** stays in Stage 9. Compute the affected drafts from the changed entry content, shared criteria and NFRs, dependencies, verification obligations, carried findings, and parent coverage, not from the edited file list alone. Redraft only those entries, and the parent too whenever the split changes. Revalidate draft completeness before showing the updated gate: every redrafted entry again needs a valid writer report, and the phrase scan is refreshed against the final drafts. After a late Switch to the full path, keep every draft that the switch left unaffected, redraft only the affected entries, and do not discard a draft because a paid review was selected or because a skipped full-path stop now runs.
   - **A change to an accepted requirement or goal** is not a wording change. Route it back through Stages 5 and 6, the implications review, the drafting-plan selection, and the Stage 8 design before drafting again.
   - **A changed epic split** is re-frozen first: rewrite `epic-manifest.json` and the review input, which invalidates any clearance and proposed overrides bound to the previous digests. Rerun a previously selected gap check using only the remaining run-wide ordinary-round, operator-fix, and confirmation capacity, resetting no budget. Rewrite a previously skipped check's skip record against the new digests without invoking a reviewer. If no permitted review capacity remains, use the existing explicit attended exception path or stop with the local artifacts. **Only under --auto:** halt as `epic_coherence`.

   Once the upload gate resolves with an explicit yes and, for an epic, the full clearance rule in the epic hand-off procedure holds, create exactly the approved set from the writer's drafts. Call `create_ticket` with `file_path` set to that entry's draft path, so the created description is identical to the file the materials pass reads. `create_ticket` prefers `file_path` over `description`.

   - **Siblings** — `create_ticket` per draft, unparented.
   - **Epic** — `create_ticket` with `issue_type` set to `Epic` for the parent first, capture the resolved epic key, then `create_ticket` with `parent_key` set to that key for each child in manifest order. The `parent_key` argument is required on every child call; never omit it.

   Create the tickets exactly as the outline named them — the split was decided and shown there, so do not create a different set than the user approved. If you now believe the split is wrong, say so and re-ask rather than changing it silently.

   **Track each ticket as you create it.** Immediately after each successful `create_ticket`, call `track_ticket` with that key and the ticket's description. Bridge's workflow state lives in its own database, not in the ticket backend, and an untracked ticket is invisible to it — `update_ticket_state` and `get_ticket_state` both return 404 until something registers the key. Tracking works against either ticket backend and is a safe no-op when the key is already tracked.

   Tracking is **warn, not halt**: if `track_ticket` returns an error of any kind, record the reason for the final report and keep going. The ticket exists and is the thing that mattered; tracking can be repeated later.

   **Then gather and attach materials for each ticket.** For every ticket `create_ticket` created — the epic parent, each child, and each sibling — first inspect that ticket's assigned draft, then run the shared `gather-and-attach-materials.md` procedure only if the draft is not confirmed empty. This pre-check applies in both modes. The order per ticket is `create_ticket`, then `track_ticket`, then this pass, then the next ticket. The pre-check and, when needed, the procedure make up "this pass".

   **Materials pre-check, before resolving or reading the procedure.** Read the draft at the path recorded for this entry. If it is readable, classify it as having no materials when its `## Materials & Access` section is absent, or when that section holds no real eligible item under `Planning Assets`, `Downloadable Assets`, or `Planning & Downloadable Assets`. Headings alone, `none`, placeholders, the writer's line `No external materials are referenced`, and record-only references are not eligible items. For a confirmed-empty key, skip the procedure read, the materials `config_field` lookup, and every attachment operation, and record the per-key outcome as `no materials`. If the draft cannot be read, warn and fall through to the materials procedure below; never classify an unread draft as empty. The timing JSONL file is never a ticket material or an attachment. For a ticket that does have materials, continue as written below.

   For a ticket that does have eligible materials (or whose draft could not be read), run the procedure. Pass three inputs: `ticket_number` (the created key), `draft_file_path` (that entry's draft path from above), and `auto_approve_external`. Pass the literal `"true"` in every run, attended or `--auto`: external and auth-gated links stay record-only and nothing prompts, so the materials pass never adds a question. Mind the polarity: in that procedure `"true"` means unattended, the more restrictive mode. It is not permission to attach external links.

   Read the procedure at `.bridge/procedures/gather-and-attach-materials-procedure.md` in this project, where the Bridge installer scaffolds it. Only if that file does not exist, read `docs/install/gather-and-attach-materials-procedure.md`; only if that file does not exist either, read `mcp_server/instructions/gather-and-attach-materials.md` in this checkout. A file that exists but cannot be read is a failure: never fall back to a later location. Unlike the coherence procedure, an unreadable or missing procedure does not stop the run: warn that the materials pass was skipped, name the affected keys, and continue. For that missing `.bridge/procedures/gather-and-attach-materials-procedure.md`, on Linux give the version-pinned terminal remedy `npx -y @bridge_gpt/mcp-server@0.2.76 repair-assets --project-root <established-root> --host <supported-host>` (quote the root); on macOS and Windows, use start-tickets for worktrees or the existing Bridge --init/install workflow for project scaffolds because in-place repair is unsupported. Then reread the procedure after provisioning before a later materials retry; the current pass remains warning/skip. Never improvise a substitute pass.

   The pass is **warn, not halt**. An attach, delete, or provenance-update failure never halts the command and never changes a halt reason. A failed attach is not `create_failed`: that reason stays reserved for a failed `create_ticket` and a failed post-create write of `epic-plan.dag.json` or `epic-plan.meta.json`. Record each failure, with its key, for the final report.

   **On a partial failure, stop and report what exists.** First run the materials pass for every ticket that was created before the failure. Ticket creation is irreversible and there is no resume protocol here: report the epic key and every child key created so far, name the entry that failed, and tell the user to re-run naming the existing epic rather than repeating this command. Do not retry the failed call in a loop, and do not create the remaining children as though nothing happened — a half-built epic the user cannot see is worse than a stopped one they can.

   **Only under --auto:** a `track_ticket` error warns and never halts: keep each confirmed key, name every untracked key in the report for reconciliation, and neither retry creation nor delete a ticket. A failed `create_ticket` attempt, even one with no key confirmed, is a `create_failed` halt. So is a failed post-create write of `epic-plan.dag.json` or `epic-plan.meta.json`. Report `created_keys` in creation order, which may be empty, and a precise `failed_entry`: the parent title, a child's manifest position and title, the failed sibling, or the failed filename. Tell a later run to reconcile those keys and that entry rather than replay creation.

   Idempotency labels are deliberately not used. They ride on `create_ticket`'s `labels` argument and are read back through `get_tickets(labels=...)`, and **both are Jira-only**: against the local ticket backend each returns a terminal `409 UNSUPPORTED_IN_LOCAL_MODE`, and the create rejects without making a ticket. A resume protocol built on them would work on one backend and silently fail on the other.

   **Write the real-key manifest (epic only, advisory, after every child exists).** After the complete child-creation loop and every materials pass, and before the plan DAG step, replace the parent's pending manifest with the frozen run order, using real keys. This is a command-owned operation; the epic hand-off procedure does not do it.

   - **Entry template.** One line per child, in frozen manifest order:

     ```text
     - {CHILD-KEY} depends_on: {KEY, KEY}
     ```

     The dependency value is `none` when the child has no hard prerequisites (`depends_on: none`). List hard `depends_on` prerequisites only, comma-separated. Never list `recommended_after`.
   - **Keys.** Resolve every child and every hard prerequisite through the confirmed `create_ticket` result mapping. Never infer a key from a child number or title. If any child or dependency has no confirmed real key, skip only this write. Never submit `TBD-N`, `CHILD-N`, or any other placeholder key.
   - **Read-only check.** Read the epic's current description with the existing ticket read and require exactly one parser-counted manifest heading: a Markdown `##` or a Jira `h2.` heading beginning "Ordered child manifest". The fetched text is read-only evidence. It is never used as update content and never patched.
   - **Body.** Build the outgoing body only from the parent Markdown source: replace its manifest span (heading through the next `#`/`##` heading or end of body) with the new section, and preserve all remaining local Markdown byte for byte. Submit it with `update_ticket_description` using that Markdown, and keep it as the new parent Markdown source. An identical repeat operation resends the same body. Never fall back to an older draft when a newer parent Markdown submission exists but its local source is unreadable.
   - **Failure is a warning.** An unreadable local source, a failed description read, a heading count other than one, a failed update, or a held update is a warning that names the epic key in the Final Report prose. Submit nothing when a precondition is unavailable. Do not retry, ask for approval, ask the owner, halt, park, or classify it as `create_failed`. Continue to the plan DAG step.
   - **Partial creation.** If child creation stopped partway, skip this operation entirely and leave the pending manifest untouched.
   - **Report.** Add the outcome (`written`, `skipped`, or `warning: <reason>`) to the Final Report line below. It adds no terminal JSON field.

4. **Write the plan DAG.** Epic only: follow step 4 of the epic hand-off procedure. Siblings skip this step.

5. **Hand off once.** Epic only: follow step 5 of the epic hand-off procedure. Siblings skip this step.


This stage is non-blocking: if the user never answers, leave the doc as written in Stage 8 and stop without forcing a decision.

**Prompt budget.** At most four ordinary stops in an attended run — the requirements page, the implications checkpoint, the drafting plan, and the upload gate — for an epic and for siblings alike. Ambiguity-resolution turns, requested changes, and the existing typed exception paths do not add ordinary workflow gates. The full path has four ordinary stops. The short path has two: the requirements page and the upload gate, unless Stage 6 item 5 requires an exceptional stop. A run that switches to the full path then owes the stops it skipped.

**Completion advisory (epic only).** Follow the section headed "Completion advisory — saved epic plans and tickets" in the epic hand-off procedure.

## Final Report

On successful completion of all stages, display:

> **Exploration Complete**
>
> **Prompt**: {first 80 characters of prompt}...
> **Output**: {full path to the exploration doc}
> **Requirements Page**: {full path to the generated requirements.html, or "not generated" when generation failed}
> **Acceptance Criteria**: {count} ratified ({count} corrected by the user, {count} still open)
> **Files Examined**: {count of key_files_examined}
> **Drafting plan**: {council option (before the design | review after the design | none, your choice)}{, review tool and scope when applicable}, gap check {run if epic | skipped}
> **Research**: {count of web_searches} web searches, {count of research_queries} deep research queries, design council {"before the design" | "review after the design (council)" | "review after the design (second opinion)" | "none, your choice"} (annotate a review that failed or that fell back, such as `failed - continued on my own design`, and never describe an unsuccessful review as completed; annotate sequential drafting as `drafted sequentially - parallel unavailable`)
>
> **Requirements**: {"Ratified" | "Unratified — page not submitted"}
> **Design**: {"Proposed" | "Not reached"}
> **Ticket(s)**: {"Created: KEY-1, KEY-2" | "Declined — doc and drafts are the artifacts" | "Not offered — work not ready"}
> **Tracking**: {"Registered" | "Warning: not tracked — {reason}" | "n/a — no tickets created"}
> **Materials**: {"No materials" | "Attached where eligible" | "Warning: {n} ticket(s) had attach failures — {keys}" | "Skipped — procedure not installed" | "n/a — no tickets created"}
> **Manifest**: {"Written with real keys" | "Warning: epic {EPIC-KEY} manifest not written — {reason}" | "Skipped — child creation was partial" | "n/a — not an epic"}
> **Plan DAG**: {"<full path to epic-plan.dag.json> — saved on the Bridge server as authored version <N>" | "<full path to epic-plan.dag.json> — Warning: plan NOT saved on the Bridge server; retry: <exact retry command>" | "n/a — not an epic"}
> **Path**: {"short" | "full" | "full (switched from short: <trigger>)" | "n/a — --auto"}
> **Gap check**: {"<No gaps found | No gaps found (N notes added to tickets) | Accepted with known gaps | Needs your decision | Skipped — your choice | Couldn't check> — <full path to epic-coherence.json>" | "n/a — not an epic"}
> **Timing**: {"Recorded: <full path to define-tickets-timing.jsonl>" | "Warning: timing record not written — <reason>" | "Unavailable — stopped before the docs directory and slug existed"}

Mark any figure from the table as `not measured` where it was; never report a stage total as complete when a required interval was unavailable.

**Timing record.** Before each terminal outcome — success, a declined or unratified completion, and every existing failure outcome — finalize timing once `docs_dir` and the slug are available. Finalizing completes the `## Run timing` table in the exploration document and appends exactly one JSON line to `{docs_dir}/explorations/define-tickets-timing.jsonl`. Create the `explorations/` directory if it is missing. The main agent is the only writer of this log. Serialize the complete record with its trailing newline and append it in one local append operation, so concurrent runs cannot interleave a line.
- **Fields, and only these:** `slug`, `date` (derived from the host clock), `path`, `mode`, `stages`, `owner_waits`, and `writers`. `path` holds the path metadata: a value of `short`, `full`, or `auto` plus an explicit boolean `escalated`. Use `auto` as the value that does not apply under `--auto`. `mode` is `attended` or `auto`.
- **Intervals.** `stages`, `owner_waits`, and `writers` are lists of attempt-level entries. Each holds a safe `name` (a stable stage name or a generated entry identity), an `attempt` number, and `seconds` as a number or JSON `null` when the interval was not measured. Keep separate attempts as separate entries; do not collapse incomplete measurements into one.
- **Privacy.** The record never holds ticket text, titles, credentials, emails, repository contents, or any free-form diagnostic payload. It carries no invented metadata.
- **Failure.** If the append fails, retry it once, then report a warning in the Timing line. A timing failure adds no halt reason, changes no terminal payload field, and undoes no completed work.
- **Early exits.** An exit before `docs_dir` and the slug exist — an invalid flag, an empty prompt, or a failed ping — has no place to persist the record. Report persistence as unavailable. Do not invent a slug, do not choose an unconfigured directory, and make no logging-related MCP call.
- **Not an input.** The timing log is never part of a research packet, a ticket's materials, or an attachment inventory.

**Only under --auto:** the report is outcome-first prose, naming the recommended drafting-plan option taken before the terminal JSON block, using these labels as they apply (the open-decision phrase warnings from Stage 9 go under **Warnings**, one line per match and entry-qualified, and they never change the terminal JSON or halt): **Warnings**, **Readiness follow-ups**, **Implications**, **Timing**, and **Recovery**. Report Requirements as `Proposed, unratified (--auto)`. Address warnings and follow-ups to the invoking operator or `/idea-to-pr` consumer. In prose, before the terminal payload, put standards-unavailable warnings, comp degradation and the design material needing manual review, council-cost notices, artifact paths, readiness follow-ups, untracked keys, materials-pass attach failures or a skipped pass (naming the keys), the Timing line with the record location or its persistence warning, and recovery instructions. End with exactly one final fenced `json` block and nothing after it:

- Siblings: `created_ticket_keys`.
- Epic: `epic_parent_key` and manifest-ordered `child_ticket_keys`, without the parent.
- Halt: `halted: true`, `halt_reason`, and only that reason's fields. The halt reason is one of `too_vague | duplicate | open_requirements | max_children | epic_coherence | create_failed | stage_failed`. Reason fields: `too_vague` carries `readiness` and `scope`; `duplicate` carries `matches`; `open_requirements` carries `open_items`; `max_children` carries `child_count` and `max_children`; `epic_coherence` carries `coherence_verdict` and `coherence_record`; `stage_failed` carries `failed_stage` and `reason`.
- `create_failed`: `halted: true`, `halt_reason`, `created_keys`, and `failed_entry`.

A halt payload never carries the success key fields. Duplicate matches never count as keys created in this run. Every auto stop, including Stage 0 and a missing shared procedure file, uses this contract.

On failure at any stage, stop immediately and report:
- Which stage failed (by number and name)
- The error details
- Any partial results that were produced before the failure

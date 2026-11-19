# RNX-6 verification hand-off

## Not verified on the epic server

- **Acceptance criterion:** Visual fidelity. The waitlist section in each state matches
  comps 01 and 13-17 at 1280px and 390px on the served epic app.
- **Why:** `epic-implementer epic-server turn acquire` returned `unavailable`, cause
  `no_live_server`, reason `helper_not_running`, on the first attempt and on the retry.
- **Human step:** Start the epic server for this run. Open the waitlist at 1280px and
  390px. Compare the default, error, joining, duplicate and success states with comps
  01 and 13-17.

## Evidence from a local production build

This evidence does not replace the check above.

- The section rendered without horizontal overflow at 320, 390, 520, 768, 1024 and
  1280px.
- Each state was captured at 1280px and 390px and compared with its comp.
- The Playwright suite, including the waitlist project, ran against the local build.

## Known differences from the comps

- City labels and places come from `content/rally.json` and computed results, so they
  differ from the comps' sample text.
- The selected skill segment is 44px tall, not about 42px, to meet the control minimum.
- Placeholder text is darker than in the comps, to meet AA contrast.

# RNX-4 verification hand-off

## Not verified on the epic server

- **Acceptance criterion:** Visual fidelity. The live region matches comps 01 and 04-07
  at 1280px and 390px on the served epic app.
- **Why:** `epic-implementer epic-server turn acquire` returned `unavailable`, cause
  `no_live_server`, reason `helper_not_running`, on the first attempt and on the retry.
- **Human step:** Start the epic server for this run. Open `/#live` at 1280px and 390px
  in the default, `weather-slow`, `weather-fail-one` and `weather-fail-all` scenarios.
  Compare each with comps 01 and 04-07. Use a freshly started `weather-slow` server for
  each viewport, because only a cold cache shows the loading state.

## Evidence from a local production build

This evidence does not replace the check above.

- Every live state was rendered at 1280px and 390px against the local weather stub and
  compared with its comp.
- Cards stayed 230px tall from loading to loaded at both widths.
- The section had no horizontal overflow at 320, 360, 390, 520, 768, 1024, 1025, 1100
  and 1280px.

## Known differences from the comps

- The stamp reads "updated just now" and "last checked 0 min ago" under the fixed clock.
  The ticket accepts this.
- The status dot uses the `court-surface` token, because the comp's brighter green is
  not a design token.
- The notice icon stays 28px on phone, as the ticket requires. Phone comp 07 shows it
  smaller.

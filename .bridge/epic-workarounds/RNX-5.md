# RNX-5 verification hand-off

## Not verified on the epic server

- **Acceptance criterion:** Visual fidelity. The finder on the served app matches comps
  08-11 and the finder region of comp 01 at 1280px and 390px.
- **Why:** `epic-implementer epic-server turn acquire` returned `unavailable`, cause
  `no_live_server`, reason `helper_not_running`, on the first attempt and on the retry.
- **Human step:** Start the epic server. Open the finder at 1280px and 390px at `/`,
  `/?day=sat`, `/?state=CO&day=tomorrow` and
  `/?state=NJ&day=today&time=am&lights=1&parking=1`. Compare them with comps 08-11 and
  the finder region of comp 01.

## Evidence from a local production build

This evidence does not replace the check above.

- The four finder URLs were captured at 1280px and 390px and compared with the comps.
- The finder had no horizontal overflow at 320, 390, 768, 1024 and 1280px, with
  JavaScript on and off.

## Known differences from the comps

- Segments are 44px tall, not about 42px, to meet the control minimum.
- On phones the section heading sits about 2px higher than in the comps.

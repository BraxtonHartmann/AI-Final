# Prompt and Agent Log

## Recording approach

Record major prompts, agent runs, decisions, checks, and remediation throughout the capstone. Preserve full transcripts through chat exports or sanitized copies when available, and link their locations here. Summaries in this file complement those transcripts.

Entries 001–004 were reconstructed on November 16, 2026 from the visible chat and tool results. Quoted user prompts are verbatim excerpts. Assistant outputs are summarized. Full raw transcripts have not yet been exported into this repository. Historical AI-run checks are distinguished from human review. Entry 006 records two implementation and test-tooling failures with remediation evidence for later human review.

For future entries, include date, exact prompt or transcript reference, agent/tool and model when known, context, changes, checks and results, human review, remediation, and commit reference. Avoid placing credentials or personal information in logs.

## 001 — Assignment review and project selection

- Date — November 12, 2026.
- User prompt — “Read through the capstone instructions I pasted and lets talk about what kind of project I could do. Dont start building anything yet.”
- Follow-up — “what about a game?”
- Agent/tools — Codex and terminal file reading. Exact model identifier was not recorded.
- Context — User-provided capstone assignment covering tracks A–F, technical deliverables, human verification, prompt logging, and reflection requirements.
- Output — Discussed several computing projects, then proposed a two-player browser escape room under Track A.
- Verification — Assignment text was read directly. Track suitability was the assistant's interpretation and has not been confirmed by the instructor.
- Human input — User selected the co-op escape-room concept for further discussion.
- Changes/commit — Discussion only.

## 002 — Puzzle and stack discussion

- Date — November 12, 2026.
- User prompt — “The co-op escape room sounds cool. What would the puzzles be like? Lets talk it through before building anything.”
- Follow-up — “what framework are we going to use and can it be on a browser?”
- Agent/tools — Codex and web documentation lookup.
- Context — Two players with different clues, a short browser playthrough, and capstone requirements for real-time interaction and validation.
- Output — Proposed a submerged research station with breaker, pressure-valve, and hatch puzzles. Proposed React, TypeScript, Vite, Node.js, and Socket.IO.
- Sources consulted — https://react.dev/learn, https://vite.dev/guide/, https://socket.io/docs/v4/rooms/.
- Verification — Consulted official framework documentation. Puzzle solvability and exact rules remain pending design and tests.
- Human input — User subsequently authorized initial project setup. Detailed puzzle mechanics and setting remain working proposals.
- Changes/commit — Discussion only.

## 003 — Local repository and React starter

- Date — November 12, 2026.
- User prompt — “lets get things intitially set up. like making the repo and geting react downloaded and whatnot. what do i need to do”
- Agent/tools — Codex, Git, Node.js v24.20.0, npm v12.0.2, and the official create-vite React TypeScript template.
- Context — Empty project directory and the previously proposed web stack.
- Changes — Initialized Git on main, generated the React TypeScript starter, installed dependencies with a lockfile, and created the initial commit.
- Recovery — Sandbox restrictions blocked Git initialization and npm registry resolution. Tool-level escalations allowed initialization and dependency downloads to succeed.
- AI-run verification — npm run build and npm run lint passed. Git reported a clean working tree after commit.
- Installation note — npm reported a blocked install script for fsevents@2.3.3. Build and lint subsequently passed. Browser development-server behavior was not verified in that run.
- Human verification — Browser playthrough and code review were not recorded.
- Commit — 986a412, chore: initialize React and TypeScript project [AI-assisted].

## 004 — GitHub publication

- Date — Reported November 16, 2026. Exact push date was not supplied.
- User statement — “I got it pushed to GitHub.”
- Human action — User reported pushing the starter to GitHub.
- AI-run verification — git status on November 16 showed main tracking origin/main without local changes.
- Pending verification — Remote repository privacy and the GitHub submission URL have not been independently checked.
- Changes/commit — No changes made by the assistant for this step.

## 005 — Initial specification and prompt log

- Date — November 16, 2026.
- User prompt — “I got it pushed to GitHub. lets write the SPEC.md and start the prompt log before we build the game.”
- Agent/tools — Codex, terminal repository inspection, and file editing. Exact model identifier was not recorded.
- Context — Visible project discussion, capstone instructions, current package.json, README, and Git status.
- Changes — Added SPEC.md with scope, user stories, acceptance criteria, proposed puzzle behavior, architecture, validation, security, accessibility, AI workflow, and capstone packaging. Added this log with reconstructed prior entries and an ongoing entry format.
- Decisions proposed by the assistant — In-memory room storage, five-minute seat reservation, thirty-minute inactivity expiry, action identifiers and state revisions, and staged implementation. These remain subject to project-owner review.
- AI-run verification — Reviewed the documents against the visible assignment and conversation. Checked whitespace with git diff --check. Documentation-only changes did not require a new app build.
- Human verification — Pending project-owner review of the specification and historical log.
- Remediation — No implementation failure case identified in this task.
- Commit — 15f3963, docs: define escape room scope and prompt log [AI-assisted]. Pushed to origin/main on November 16, 2026.

## 006 — Two-player lobby implementation

- Date — November 16, 2026.
- User prompt — “Lets commit and push those, then start building the two-player lobby.”
- Agent/tools — Codex, Git, npm, Node.js, Socket.IO, TypeScript, Playwright Chromium, Prettier, and official Socket.IO documentation. Exact model identifier was not recorded. No subagents were used.
- Context — SPEC.md, prior project discussion, current React starter, package configuration, and repository status.
- Publication — Committed SPEC.md and PROMPT_LOG.md as 15f3963 and pushed to origin/main before implementation.
- Changes — Added server-owned two-player rooms, random room codes and separate private seat credentials, exclusive role selection, readiness and start gates, shared briefing, leave behavior, refresh/reconnect recovery, seat and room expiration, request validation, and per-address request limits. Added shared message types, a responsive React interface, automated tests, backend type checking, run instructions, and AGENTS.md repository context. The latter was written during the implementation wrap-up and applies to subsequent work.
- Working design decisions — Used “Below the Surface” as a proposed title and a dark underwater control-panel visual style. Adopted the specification's proposed five-minute seat reservation and thirty-minute inactivity expiry. Sessions are kept in memory and browser credentials in sessionStorage. Reclaiming a seat replaces its previous connection. Either ready player can start once both meet the requirements. Leaving or losing an expired seat returns the remaining player to the lobby. Puzzle gameplay remains pending.
- Test-driven evidence — Wrote the initial lobby rule tests before the lobby module. The first run failed with ERR_MODULE_NOT_FOUND because implementation had not been created. Implemented the rules, then exercised the real transport and browser entry points.
- Failure case candidate 1 — The AI used node:events once(socket, 'connect') in the transport test. Backend type checking failed with TS2769 because the Socket.IO client did not satisfy that helper's declared event-source overload. Replaced it with a Promise resolved by socket.once('connect') and rejected by socket.once('connect_error'). The build and transport test then passed. This was a test-code typing error detected by the compiler.
- Failure case candidate 2 — The initial Playwright configuration treated an already-running Vite frontend as proof that the combined app was ready. Browser tests could not connect to the absent backend, leaving Create a room disabled. Inspected test output and local listeners, then changed Playwright to check/start the backend health endpoint and frontend separately. Both browser tests then passed with the existing frontend reused. This was a test-runner readiness bug.
- Additional review — Reset readiness on every successful seat recovery so a refresh that reclaims a still-connected seat also requires readiness confirmation. Verified with rule and browser flows.
- Environment recovery — Local socket listening and browser execution required tool-level sandbox escalation. npm reported the same blocked optional fsevents install script as the initial setup. The local servers, build, and browser checks subsequently worked.
- AI-run verification — Five rule/transport tests passed. Two Chromium browser tests passed, covering two-player join, capacity rejection, role selection, refresh recovery, synchronized start, leave, keyboard form submission, and mobile overflow. Build and lint passed. npm dependency installation/lockfile verification reported zero vulnerabilities across 75 packages. Git whitespace checks passed.
- Visual verification — Captured desktop entry, desktop room, and mobile entry screenshots in temporary files for inspection. Screenshots are verification artifacts outside the repository.
- Human verification — Pending project-owner code review and manual playtesting. Firefox, Safari, screen-reader review, and a full automated accessibility audit remain pending.
- Current run state — Existing Vite frontend was reused. Started the new backend separately for local preview. Future fresh runs use npm run dev to start both.
- Commit — 85a1b5c, feat: implement two-player lobby and recovery [AI-assisted]. Committed and pushed on the next user request.

## 007 — Publish lobby and build Restore Power

- Date — November 16, 2026.
- User prompt — “Lets commit and push the lobby, then start building the first puzzle.”
- Agent/tools — Codex, terminal Git/npm/Node.js tools, TypeScript, Socket.IO, Playwright Chromium, and Prettier. Exact model identifier was not recorded. No subagents were used.
- Context — Read AGENTS.md, SPEC.md, README.md, the prior chat, current server/client protocol and lobby code, reconnect logic, and existing tests.
- Publication — Committed the lobby and accompanying records as 85a1b5c with [AI-assisted] and pushed to origin/main before building the puzzle.
- Design choices — Used the fixed safe sequence Tide → Anchor → Beacon and designated Coil as damaged. A wrong activation trips the panel. Only the equipment operator can reset. Completion leads to a shared power-restored screen while the second puzzle remains pending. These initial mechanics were chosen by the assistant within the discussed breaker-puzzle design for project-owner review.
- Test-driven evidence — Added power-rule tests before creating server/power.ts. The initial run failed with ERR_MODULE_NOT_FOUND. After implementation, solution, trip, reset, and terminal-state tests passed.
- Changes — Added deterministic server-side rules, private analyst instructions, role-specific snapshots for both broadcasts and acknowledgments, operator switches, analyst wiring diagram, shared status, reset, completion, and progress recovery after refresh. Added version checks and accepted-action ID deduplication across reconnects/resets. Duplicate IDs with different payloads are rejected. Puzzle controls pause while a partner is offline. Leaving or losing an expired seat clears the run. Updated documentation and browser tests to replace the previous briefing milestone.
- Additional review — Used the room revision check for acknowledgments and reconnect snapshots as well as broadcasts so an older response cannot overwrite a newer snapshot. Kept solution constants in the server module. Operator messages omit the sequence and damaged-circuit fields. A 1,024-action bound limits per-room replay history.
- Environment recovery — The sandbox blocked socket listening during the initial full test run. Retried the transport checks with tool-level escalation. An offline npm formatting invocation could not resolve cached package metadata, so ran the existing cached Prettier binary directly.
- AI-run verification — Nine rule/transport tests and three Chromium browser tests passed. Coverage includes wrong/damaged breakers, reset, exact solution, operator authorization, private broadcasts and acknowledgments, malformed requests, stale versions, duplicate IDs, partner disconnection, refresh recovery, synchronized completion, and mobile overflow. Build and lint passed. Desktop and mobile screenshots of both roles were visually inspected from temporary files outside the repository.
- Human verification — Pending project-owner playtesting and code review. Firefox, Safari, screen-reader review, and the full accessibility/security audits remain pending.
- Commit — 0b4e6c7, feat: add cooperative power puzzle [AI-assisted]. Committed and pushed on the next user request.

## 008 — Publish power, build pressure, and expand to four puzzles

- Date — November 16, 2026.
- User prompt — “that is looking good, we will eventually go back and make it more dificult but for now lets commit and push it and start on the next puzzle, also we should include a 4th puzzle so each person has the opourtunity to do 2”
- Agent/tools — Codex, terminal Git/npm/Node.js tools, TypeScript, Socket.IO, Playwright Chromium, cached Prettier, and local screenshot inspection. Exact model identifier was not recorded. No subagents were used.
- Context — Read AGENTS.md, SPEC.md, README.md, existing power rules, lobby/session logic, message validation, role-specific UI, and tests. User approved the current direction visually and deferred increased difficulty.
- Publication — Committed the power puzzle and its records as 0b4e6c7 with [AI-assisted] and pushed to origin/main before starting pressure.
- Scope change — Expanded the planned game to four puzzles. Equipment operates power and the proposed transmitter puzzle. Control operates pressure and the proposed hatch puzzle. The partner supplies necessary information in each. The transmitter concept and revised hatch split are assistant proposals for the two future puzzles. Increased difficulty remains deferred.
- Initial pressure design — Control operates Intake, Bypass, and Return valves and the pump. Equipment reads two private pressure gauges and the inclusive 45–55 kPa safe range. Starting readings are 80/20. Intake contributes −20/+10, Bypass −10/+20, and Return +15/−15. Opening Intake and Bypass while keeping Return closed yields 50/50. Closing reverses a valve's contribution. Reset restores the initial pressure configuration while retaining restored power. Unsafe pump requests are rejected without mutation. Successful pumping completes the pressure milestone.
- Test-driven evidence — Wrote tests for pressure solution, all eight valve configurations, reversal, bounds, reset, terminal state, and role privacy before creating server/pressure.ts. The initial run failed with ERR_MODULE_NOT_FOUND. Those tests passed after implementation.
- Changes — Added pressure rules and filtered views, valve and pump controls, numerical gauges, keyboard operation, reset and completion screens, and a gated Continue to airlock transition. Reused the power puzzle's authorization, connection checks, action-ID history, version checks, and room snapshot infrastructure through a shared internal puzzle-action method. Added rule, lobby, real-transport, and browser coverage. Updated SPEC.md, README.md, and AGENTS.md for the four-puzzle plan and operating-role alternation.
- AI-run verification — Fourteen rule/transport tests passed, including real-network malformed pressure messages, authorization, duplicate actions, and private broadcasts/acknowledgments. Four Chromium browser tests passed, including the full power-to-pressure flow, operating-role swap, unsafe pump rejection, reversible valves, reset, keyboard activation, both roles refreshing mid-puzzle, completed-state refresh, and narrow-screen overflow. Build, lint, and Git whitespace checks passed. Visually inspected desktop and mobile screenshots of both pressure roles in temporary files outside the repository.
- Human verification — Pending project-owner playtesting and code review of pressure. Firefox, Safari, screen-reader review, and the full accessibility/security audits remain pending. The user's positive feedback on power was recorded as feedback, without assuming a completed code audit.
- Limitations — Only the first two puzzles are implemented. Transmitter and hatch remain planned. Rooms remain in memory, and restarting the backend ends active sessions.
- Workspace observation — Near wrap-up, three additional untracked files appeared in src: App 2.tsx, App 2.css, and index 2.css. They were not created by the assistant commands in this task and were not edited or staged. Build and lint were rechecked with these files present. Their origin has not been established.
- Commit — 8832333, feat: add cooperative pressure puzzle and four-system plan [AI-assisted]. Committed and pushed on the next user request.

## 009 — Publish pressure and build the transmitter

- Date — November 16, 2026.
- User prompt — “That looks good, lets commit and push the pressure puzzle and start building the transmitter puzzle next.”
- Agent/tools — Codex, terminal Git/npm/Node.js tools, TypeScript, Socket.IO, Playwright Chromium, cached Prettier, and local screenshot inspection. Exact model identifier was not recorded. No subagents were used.
- Context — Read AGENTS.md, SPEC.md, README.md, the existing protocol, session/puzzle action logic, pressure and power UIs, and test coverage. Maintained the requested four-puzzle operating split and deferred difficulty increases.
- Publication — Committed the pressure puzzle and its records as 8832333 with [AI-assisted] and pushed to origin/main before starting transmitter work. The three previously observed duplicate-named source files were omitted from the commit as unrelated untracked files.
- Initial transmitter design — Equipment operates the radio. Control receives a private chart for Maintenance, Rescue, and Supply channels. The initial rescue solution is 5.6 MHz, west, and four-digit code 7314. These fictional game settings are assistant-selected mechanics for the initial version. Equipment applies a complete configuration, then transmits the saved values. An incorrect configuration produces shared No acknowledgment feedback and allows retuning or reset. Correct settings produce a shared acknowledgment and lock the controls. Reset preserves completed power and drainage. Applied settings survive refresh, while unsaved form edits remain local drafts.
- Test-driven evidence — Added transmitter solution, incorrect settings, reset, terminal-state, and privacy tests before creating server/transmitter.ts. The initial run failed with ERR_MODULE_NOT_FOUND. The rules passed after implementation.
- Changes — Added deterministic transmitter rules, role-filtered radio/chart views, runtime settings validation, UI controls and chart cards, reset, unanswered feedback, completion, and a transition from pressure. Reused shared puzzle authorization, partner connection checks, version checks, action deduplication, and session recovery. Added targeted progression to preserve the current stage when an earlier transition is repeated or delayed. Legacy continue requests retain their original pressure destination.
- Detected issue and remediation — Backend type checking found TS2322 in the new tests because numeric frequency literals widened to number, while RadioSettings accepts a defined set of frequency values. Marked the test values as literal constants. The subsequent build passed. This was a test typing issue.
- Verification setup — Limited Playwright to two workers to bound simultaneous browser load as coverage grew. The three-puzzle browser test has a sixty-second limit to accommodate its longer user flow. Its successful run completed in approximately sixteen seconds.
- AI-run verification — Nineteen rule/transport tests and five Chromium browser tests passed. Coverage includes exact rescue tuning, unanswered attempts, reset, role authorization, private broadcasts and acknowledgments, malformed settings and codes, duplicate IDs, stale versions, targeted stage gates, partner disconnection, saved settings recovery after refresh, keyboard form submission, synchronized acknowledgment, and mobile overflow. Build, lint, and Git whitespace checks passed. Desktop and mobile screenshots of the radio and private chart were captured in temporary files outside the repository and visually inspected.
- Human verification — Pending project-owner transmitter playtesting and code review. Firefox, Safari, screen-reader review, and the full accessibility/security audits remain pending.
- Limitations — Three puzzles are implemented. The final hatch puzzle remains pending. Rooms remain in memory, and backend restarts end active sessions.
- Commit — Transmitter and updated records saved locally, pending review and commit. Pressure push is complete.

## Future entry template

```text
Entry number and task
Date
Exact prompt or transcript location
Agent, tools, and model identifier if known
Context supplied and acceptance criteria
Output and changed files
AI-run checks and actual results
Human review and independently performed checks
Failure, detection, remediation, and retest evidence if applicable
Open questions
Commit reference
```

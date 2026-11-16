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
- Commit — Lobby changes pending review and commit. Documentation push is complete.

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

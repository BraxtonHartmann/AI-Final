# Repository context

This is a CS 3810 capstone built with AI assistance. Read SPEC.md for scope and acceptance criteria, README.md for run instructions, and PROMPT_LOG.md for decisions and verification history. The current implementation covers the two-player lobby and briefing.

## Engineering workflow

- Keep authoritative room and puzzle rules on the server. Send clients only the information their role needs.
- Validate network input at runtime and verify session ownership before changing state.
- Write meaningful rule and failure-case tests before implementing new behavior, following the capstone's test-driven requirement.
- Use npm test for server rules and transport checks, npm run test:e2e for browser flows, npm run build for TypeScript and frontend output, and npm run lint for static checks.
- Update PROMPT_LOG.md with the request, context, changes, actual verification results, and remediation. Distinguish AI-run checks from human review.
- Include [AI-assisted] in commits generated primarily with AI assistance.
- Record proposed scope decisions and unresolved limitations explicitly. Keep raw credentials out of logs and Git.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package Manager
Use `bun` (not npm or yarn).

# Commit Format
`prefix(area): message` — single line, no description body.

# UI
Do not use `text-xs` for any font sizes. Use `text-sm` as the minimum.

# Verification
Run `bun run verify` after completing any code changes to confirm there are no type errors.

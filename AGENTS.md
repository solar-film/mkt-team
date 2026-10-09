<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Saving and publishing changes

- After each requested edit, verify the relevant behavior and save the intended source changes in a local Git commit. Preserve unrelated user changes.
- Push to GitHub and deploy to the live website only when the user explicitly asks. The user decides when to publish; editing or previewing alone does not authorize publishing.
- Keep credentials, environment files, dependencies, build outputs, and machine-specific preview helpers out of commits.

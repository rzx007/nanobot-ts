---
name: memory
description: Two-layer memory system with SQLite-based recall.
always: true
---

# Memory

## Structure

- `memory/MEMORY.md` — Long-term facts (preferences, project context, relationships). Always loaded into your context.
- SQLite `session_messages` table — Complete conversation history stored in database.

## Search Past Events

Use the `search_history` tool to search conversation history:

```javascript
search_history({
  keyword: "meeting",
  limit: 20,  // optional, default 20
  channel: "telegram",  // optional, filter by channel
  days: 7  // optional, search last N days, default 30
})
```

Supported filters:
- `keyword`: Search keyword (required, fuzzy match)
- `channel`: Filter by channel (cli, telegram, discord, web, etc.)
- `days`: Time range in days (default 30)
- `limit`: Result count limit (default 20)

## When to Update MEMORY.md

Write important facts immediately using `edit_file` or `write_file`:
- User preferences ("I prefer dark mode")
- Project context ("The API uses OAuth2")
- Relationships ("Alice is the project lead")

## Auto-consolidation

Old conversations are automatically summarized and appended to MEMORY.md when the session grows large. Long-term facts are extracted to MEMORY.md. You don't need to manage this.

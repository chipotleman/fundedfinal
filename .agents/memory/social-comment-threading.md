---
name: Social comment threading & reply notifications
description: How Piks social-feed comments nest (parent_id) and who gets notified on a reply vs a top-level comment.
---

Social post comments support Instagram-style threaded replies. A comment's
`parent_id` points at the comment being replied to (NULL = top-level). The graph
is append-only — you can only reply to an already-existing (older) comment — so
it is structurally a forest and a cycle cannot occur in practice.

**Reply target = parent comment's author**, NOT parsed from the @mention text.
The "@handle" the composer prefills is display-only; the authoritative
notification recipient is `parent.userId`. So the @ text and the notified user
can technically diverge if a user edits the prefilled handle — that's accepted.

**Notification fan-out rule (max two people, never duplicated):**
- Replied-to user → type `'reply'` ("X replied to you").
- Post owner → type `'comment'`.
- If the reply target *is* the post owner, the more specific `'reply'` wins and
  the duplicate `'comment'` is suppressed. Self-actions are always skipped.
- **Why:** a single reply must never produce two bell rows for the same person.

**Thread rendering must never drop a comment.** Any client-side grouping of the
flat comment list into root+replies has to resolve a root for *every* comment —
orphans (missing parent) and any cyclic/corrupt chain must fall back to being
their own root. An earlier version keyed replies under a root that was never
emitted, which silently dropped them.

**`type` column is varchar(16)** in social_notifications — keep new notification
type strings short (`reply`, `comment`, `like` all fit).

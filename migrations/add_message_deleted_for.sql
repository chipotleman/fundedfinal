-- Per-user "delete for me" list for chat messages. Holds the user IDs who
-- have hidden a message from their own view (WhatsApp/Instagram-style) while
-- the other participant keeps seeing it. The DELETE handler appends the
-- requester's id here for `?scope=me`, and hard-deletes the row only once both
-- participants have hidden it. Reads (thread GET, inbox preview, unread count)
-- exclude rows where the requesting user is present. Rows predating this
-- column default to an empty array.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_for JSONB DEFAULT '[]'::jsonb;

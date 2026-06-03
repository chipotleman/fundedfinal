-- Threaded replies on social post comments. parent_id points at the comment
-- being replied to (NULL = top-level comment). Enables Instagram-style reply
-- chains and @mention notifications to the replied-to user.
ALTER TABLE social_post_comments ADD COLUMN IF NOT EXISTS parent_id varchar;
CREATE INDEX IF NOT EXISTS social_post_comments_parent_id_idx ON social_post_comments (parent_id);

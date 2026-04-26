-- Pre-computed waveform peaks captured at voice-note send time so the
-- chat bubble can render its visualizer instantly without re-fetching
-- and decoding the audio file on mount. Stored as a small JSON array of
-- normalized floats (typically 36 entries between 0 and 1). Existing
-- voice notes have NULL here and fall back to the on-demand decode path.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_peaks JSONB;

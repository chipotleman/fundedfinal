// Centralized localStorage keys for in-app cue preferences (haptics, sounds,
// quiet mode). Both the Settings page and the components/hooks that read
// these preferences import from here so the keys stay in lockstep without
// the Settings page having to depend on a heavy UI component module just
// to grab a string constant.

export const CUE_STORAGE_KEYS = {
  LEAD_HAPTIC: 'piks_lead_cue_haptics',
  LEAD_SOUND: 'piks_lead_cue_sound',
  ACHIEVEMENT_UNLOCK_HAPTIC: 'piks_achievement_unlock_haptics',
  QUIET_MODE: 'piks_quiet_mode',
};

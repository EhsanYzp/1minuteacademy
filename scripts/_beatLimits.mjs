// Centralized beat-length policy.
//
// Generation (topic JSON generation) is strict to keep 8-second reads comfortable.
// Validation is slightly more tolerant to avoid churn over minor overages.

export const GENERATION_LIMITS = Object.freeze({
  beat: 120,
  punchline: 80,
});

export const VALIDATION_TOLERANCE = Object.freeze({
  beat: 130,
  punchline: 90,
});

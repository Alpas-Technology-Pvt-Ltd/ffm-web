/**
 * SLA Configuration
 * 
 * Centralized place for all SLA-related thresholds.
 * Toggle SLA_TEST_MODE to 'true' to use shorter times for testing alerts.
 */

export const SLA_TEST_MODE = false; // Toggle this to true for testing

const STANDARD_THRESHOLDS = {
  RESPONSE_HOURS: 1,
  RESOLUTION_HOURS: 3,
  VALIDATION_MINUTES: 30,
};

const TEST_THRESHOLDS = {
  RESPONSE_HOURS: 0.083, // ~5 minutes
  RESOLUTION_HOURS: 0.166, // ~10 minutes
  VALIDATION_MINUTES: 2,   // 2 minutes
};

export const SLA_CONFIG = SLA_TEST_MODE ? TEST_THRESHOLDS : STANDARD_THRESHOLDS;

/**
 * Gets the configured SLA threshold for a specific type.
 * Useful if we want to add more complex logic later.
 */
export const getSLAThreshold = (type: keyof typeof STANDARD_THRESHOLDS) => {
  return SLA_CONFIG[type];
};

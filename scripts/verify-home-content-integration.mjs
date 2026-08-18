const REQUIRED_FRAGMENTS = [
  ['getProfile', 'home must load profile through getProfile'],
  ['getVisibleExperiences', 'home must load visible experiences through getVisibleExperiences'],
  ['profile.data.headline', 'home must render the profile headline'],
  ['profile.data.introduction', 'home must render the profile introduction'],
  ['profile.data.skills', 'home must render profile skills'],
  ['latestExperience &&', 'home must hide the fact row when no experience is visible'],
];

/**
 * Check that the home page receives personal data through its public content boundaries.
 *
 * @param {string} source home page source
 * @returns {string[]} content integration contract violations
 */
export function verifyHomeContentIntegration(source) {
  const missing = REQUIRED_FRAGMENTS.filter(([fragment]) => !source.includes(fragment)).map(
    ([, message]) => message,
  );

  if (source.includes("getCollection('experience')")) {
    missing.push('home must not read experience collections directly');
  }

  return missing;
}

const REQUIRED_SECTION_MARKERS = [
  ['about-heading', 'about section is missing'],
  ['stack-heading', 'stack section is missing'],
  ['portfolio-heading', 'portfolio section is missing'],
  ['recent-posts-heading', 'recent posts section is missing'],
];

/**
 * Check the static home output for the non-interactive portfolio hierarchy.
 *
 * @param {string} html prerendered home page HTML
 * @returns {string[]} semantic markers missing from the built page
 */
export function verifyHomeLayout(html) {
  const missing = [];

  if (html.includes('<canvas')) {
    missing.push('canvas must not be present');
  }

  for (const [marker, message] of REQUIRED_SECTION_MARKERS) {
    if (!html.includes(marker)) missing.push(message);
  }

  return missing;
}

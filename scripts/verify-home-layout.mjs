const REQUIRED_SECTION_MARKERS = [
  ['about-heading', 'about section is missing'],
  ['recent-posts-heading', 'recent posts section is missing'],
  ['doors-heading', 'career/portfolio doors are missing'],
];

const REQUIRED_DOORS = [
  ['href="/career"', 'career door link is missing'],
  ['href="/portfolio"', 'portfolio door link is missing'],
];

/**
 * Check the static home output for the entry-point hierarchy (NOR-151).
 *
 * The home page introduces the person, shows recent writing, and then handsreaders off to
 * the career and portfolio pages. Listing projects on the home page itself is what this
 * structure replaced, so a project grid here is a regression.
 *
 * @param {string} html prerendered home page HTML
 * @returns {string[]} semantic markers missing from the built page
 */
export function verifyHomeLayout(html) {
  const missing = [];

  if (html.includes('<canvas')) {
    missing.push('canvas must not be present');
  }

  for (const [marker, message] of [...REQUIRED_SECTION_MARKERS, ...REQUIRED_DOORS]) {
    if (!html.includes(marker)) missing.push(message);
  }

  if (html.includes('home-project-grid')) {
    missing.push('projects must live on the portfolio page, not the home page');
  }

  return missing;
}

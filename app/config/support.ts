/**
 * Where people can support this fork.
 * Empty strings are omitted from the UI — fill what you actually use.
 */
const REPOSITORY = 'https://github.com/erdinoral/minimax-m3-studio';

export const SUPPORT_LINKS = {
  buyMeACoffee: 'https://buymeacoffee.com/erdindev',
  /** GitHub Sponsors (enable at https://github.com/sponsors). */
  githubSponsors: 'https://github.com/sponsors/erdinoral',
  repository: REPOSITORY,
  issues: `${REPOSITORY}/issues`,
  newBug: `${REPOSITORY}/issues/new?template=bug.md`,
  newIdea: `${REPOSITORY}/issues/new?template=feature.md`,
} as const;

export interface Sponsor {
  name: string;
  amount: string;
  /** The first sponsor gets the longer thank-you in the panel and the banner. */
  first?: boolean;
}

/** Shown in the Support panel and rotated through the banner above the player. */
export const SPONSORS: readonly Sponsor[] = [
  { name: 'Diamond204a', amount: '$25', first: true },
  { name: 'Corey', amount: '$5' },
];

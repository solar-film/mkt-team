// Links to other sites (feedback, BB Meeting) open in a new tab so the team keeps this page.
export const externalLinkProps = (path: string): { target?: '_blank'; rel?: string } =>
  /^https?:\/\//.test(path) ? { target: '_blank', rel: 'noopener noreferrer' } : {};

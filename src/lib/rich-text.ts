import sanitizeHtml from 'sanitize-html';

/** Preserve meeting formatting and tables while removing executable HTML. */
export function safeMeetingHtml(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'span', 's', 'u', 'sub', 'sup'],
    allowedAttributes: {
      '*': ['class', 'style'], a: ['href', 'title', 'target', 'rel'],
      td: ['colspan', 'rowspan', 'style', 'class', 'data-row'],
      th: ['colspan', 'rowspan', 'style', 'class'], col: ['width', 'style'],
      ol: ['start'], li: ['data-list', 'class'],
    },
    allowedStyles: { '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i, /^[a-z]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i, /^[a-z]+$/i],
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(bold|normal|[1-9]00)$/],
      width: [/^\d+(\.\d+)?(px|%)$/],
      'border-collapse': [/^(collapse|separate)$/],
      border: [/^\d+px solid (#[0-9a-f]{3,8}|[a-z]+)$/i],
      padding: [/^[\d.]+(px|em|rem)( [\d.]+(px|em|rem)){0,3}$/],
    } },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) },
  });
}

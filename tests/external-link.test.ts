import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { externalLinkProps } from '../src/lib/external-link';

test('links to other sites open in a new tab without access to this page', () => {
  assert.equal(JSON.stringify(externalLinkProps('https://solar-film.github.io/feedback/admin/')), JSON.stringify({ target: '_blank', rel: 'noopener noreferrer' }));
  assert.equal(externalLinkProps('http://example.com').target, '_blank');
});

test('pages inside the app keep opening in the same tab', () => {
  for (const path of ['/', '/company', '/calendar', 'https-not-a-url']) {
    assert.equal(JSON.stringify(externalLinkProps(path)), '{}', path);
  }
});

test('the sidebar uses the shared helper for every menu link', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  assert.match(sidebar, /from '@\/lib\/external-link'/);
  assert.equal((sidebar.match(/\{\.\.\.externalLinkProps\(link\.path\)\}/g) || []).length, 2); // side menu + mobile "เพิ่มเติม"
});

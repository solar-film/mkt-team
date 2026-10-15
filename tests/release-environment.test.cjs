'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { REQUIRED, missingProductionVariables, checkReleaseEnvironment } = require('../scripts/check-release-env.cjs');

test('local and preview builds do not require production secrets', () => {
  assert.deepEqual(missingProductionVariables({}), []);
  assert.deepEqual(missingProductionVariables({ VERCEL_ENV: 'preview' }), []);
});

test('production refuses every missing, empty or masked required value', () => {
  const env = Object.fromEntries(REQUIRED.map(name => [name, 'test-value']));
  env.VERCEL_ENV = 'production';
  assert.deepEqual(missingProductionVariables(env), []);
  for (const name of REQUIRED) {
    for (const value of [undefined, '', '   ', '[SENSITIVE]', '<configure privately>']) {
      assert.deepEqual(missingProductionVariables({ ...env, [name]: value }), [name]);
    }
  }
});

test('the release check reports names without leaking configured secrets', () => {
  const output = [];
  const log = { error: message => output.push(message), log: message => output.push(message) };
  assert.equal(checkReleaseEnvironment({ VERCEL_ENV: 'production', DATABASE_URL: 'test-private-value' }, log), false);
  assert.match(output[0], /LINE_CHANNEL_SECRET/);
  assert.doesNotMatch(output.join('\n'), /test-private-value/);
});

test('Vercel default and migration build paths both stop before build when configuration is missing', () => {
  const defaultConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(defaultConfig.git.deploymentEnabled.main, false, 'Pushing source must respect the owner’s decision to wait before deploying');
  for (const file of ['vercel.json', 'vercel.release.json']) {
    const config = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(config.buildCommand.startsWith('node scripts/check-release-env.cjs && '));
  }
  const result = spawnSync(process.execPath, ['scripts/check-release-env.cjs'], {
    encoding: 'utf8', env: { VERCEL_ENV: 'production' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production release stopped/);
});

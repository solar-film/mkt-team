'use strict';

const REQUIRED = ['DATABASE_URL', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_GROUP_ID', 'LINE_CHANNEL_SECRET', 'CRON_SECRET', 'ADMIN_PASSWORD'];

function missingProductionVariables(env) {
  if (env.VERCEL_ENV !== 'production') return [];
  return REQUIRED.filter(name => {
    const value = env[name];
    return typeof value !== 'string' || !value.trim() || /\[SENSITIVE\]|^<.*>$/.test(value.trim());
  });
}

function checkReleaseEnvironment(env = process.env, log = console) {
  const missing = missingProductionVariables(env);
  if (missing.length) {
    log.error(`Production release stopped. Configure server variables: ${missing.join(', ')}. No values were logged.`);
    return false;
  }
  log.log(env.VERCEL_ENV === 'production' ? 'Production server configuration is present.' : 'Local/preview build: production configuration check skipped.');
  return true;
}

module.exports = { REQUIRED, missingProductionVariables, checkReleaseEnvironment };
if (require.main === module && !checkReleaseEnvironment()) process.exitCode = 1;

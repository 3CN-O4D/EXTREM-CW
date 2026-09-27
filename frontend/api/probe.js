const out = [];
const t = (label, fn) => {
  try { fn(); out.push(label + ': OK'); }
  catch (e) { out.push(label + ': ERR ' + e.message); }
};
t('express', () => require('express'));
t('pg', () => require('pg'));
t('serverless-http', () => require('serverless-http'));
t('jsonwebtoken', () => require('jsonwebtoken'));
t('bcryptjs', () => require('bcryptjs'));
t('cors', () => require('cors'));
t('../server/src/index', () => require('../server/src/index'));
out.push('cwd=' + process.cwd());
out.push('NODE_PATH=' + (process.env.NODE_PATH || ''));

module.exports = async () => ({ statusCode: 200, body: out.join('\n') });
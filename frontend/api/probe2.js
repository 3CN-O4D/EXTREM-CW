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
out.push('cwd=' + process.cwd());

module.exports = async () => ({ statusCode: 200, body: out.join('\n') });
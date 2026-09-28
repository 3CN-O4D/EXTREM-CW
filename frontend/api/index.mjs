export default (event) => {
  console.log('ARITY1_CALLED', JSON.stringify(Object.keys(event || {})), 'method=' + (event && event.method), 'httpMethod=' + (event && event.httpMethod));
  return Promise.resolve({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      keys: event ? Object.keys(event) : [],
      method: event && event.method,
      httpMethod: event && event.httpMethod,
      path: event && event.path,
      bodyType: event && typeof event.body,
      sourceIp: event && event.ip,
    }),
  });
};
module.exports = (event, context) => {
  const summary = {
    eventType: typeof event,
    eventKeys: event ? Object.keys(event) : [],
    contextKeys: context ? Object.keys(context) : [],
    method: event && event.method,
    httpMethod: event && event.httpMethod,
    path: event && event.path,
    url: event && event.url,
    hasRequestContext: !!(event && event.requestContext),
    headersCount: event && event.headers ? Object.keys(event.headers).length : -1,
    bodyType: event && typeof event.body,
    version: event && event.version,
  };
  return new Promise((resolve) => {
    resolve({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(summary),
    });
  });
};
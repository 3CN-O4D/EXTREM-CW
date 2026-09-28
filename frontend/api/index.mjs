export default (event, context) => {
  return Promise.resolve({
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      eventType: typeof event,
      eventKeys: event ? Object.keys(event) : [],
      method: event && event.method,
      httpMethod: event && event.httpMethod,
      path: event && event.path,
    }),
  });
};
import serverless from 'serverless-http';
import { createApp } from './app';

const app = createApp();

// Export for Vercel (@vercel/node).
export default serverless(app);
export { app };

// Local dev server (not used on Vercel).
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const port = process.env.PORT || 8001;
  app.listen(port, () => {
    console.log(`Carwash POS API listening on http://localhost:${port}`);
  });
}
// Vercel function entry point — re-exports the serverless handler from the
// shared server code. Kept tiny so @vercel/node has an unambiguous entry.
export { default } from '../server/src/index';
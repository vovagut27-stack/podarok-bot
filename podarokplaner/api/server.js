import serverless from 'serverless-http';

let handlerPromise;

export default async function handler(req, res) {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { createApp } = await import('../bot/app.js');
      const app = await createApp();
      return serverless(app);
    })().catch((err) => {
      handlerPromise = null;
      throw err;
    });
  }
  const fn = await handlerPromise;
  return fn(req, res);
}

export const config = { maxDuration: 60 };

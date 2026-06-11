import serverless from 'serverless-http';

let handlerPromise;

async function createHandler() {
  const { createApp } = await import('../podarokplaner/bot/app.js');
  const app = await createApp();
  return serverless(app);
}

export default async function handler(req, res) {
  if (!handlerPromise) {
    handlerPromise = createHandler().catch((err) => {
      handlerPromise = null;
      throw err;
    });
  }
  const fn = await handlerPromise;
  return fn(req, res);
}

export const config = { maxDuration: 60 };

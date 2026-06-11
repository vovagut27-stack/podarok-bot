import serverless from 'serverless-http';

let handlerPromise;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { createApp } = await import('../podarokplaner/bot/app.js');
      const app = await createApp();
      return serverless(app);
    })();
  }
  return handlerPromise;
}

export default async function handler(req, res) {
  const fn = await getHandler();
  return fn(req, res);
}

export const config = { maxDuration: 30 };

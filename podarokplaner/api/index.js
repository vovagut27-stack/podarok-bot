import serverless from 'serverless-http';

let handlerPromise;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const { createApp } = await import('../bot/app.js');
      const app = await createApp();
      return serverless(app);
    })();
  }
  return handlerPromise;
}

export default async function (req, res) {
  const handler = await getHandler();
  return handler(req, res);
}

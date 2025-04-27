/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


import { sendMessageToSQS } from './sqs.js';

export default {
  async fetch(request, env, ctx) {


    
    const now = new Date();
    // const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
    // const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
    // const now = new Date();
    // const AWS_ACCESS_KEY_ID = AWS_ACCESS_KEY_ID;
    // const AWS_SECRET_ACCESS_KEY = AWS_SECRET_ACCESS_KEY;

    const response = await sendMessageToSQS(now);
    return response;
  },
};

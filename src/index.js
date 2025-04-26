/*const AWS_REGION = 'us-east-2';
const QUEUE_URL = 'https://sqs.us-east-2.amazonaws.com/960565814764/my-test-queue';

export default {
  async fetch(request, env, ctx) {
    const now = new Date();
    const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
    const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;

    console.log(request);
    const requestId = request.headers.get('x-request-id');

    // if (requestId === 'test') {
    //   // Logic to send a message to SQS
    //   const response = await sendMessageToSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY);
    //   return response;
    // } else if (requestId === 'process') {
    //   // Logic to receive and delete a message from SQS
    //   const response = await processMessageFromSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY);
    //   return response;
    // }

    return new Response('Invalid request ID', { status: 400 });
  },
};

// Function to send a message to SQS
async function sendMessageToSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const endpoint = new URL(QUEUE_URL);
  const host = endpoint.host;

  const params = new URLSearchParams({
    Action: 'SendMessage',
    MessageBody: JSON.stringify({ message: 'Hello, this is from Cloudflare Worker!' }),
    Version: '2012-11-05',
  });

  const path = endpoint.pathname;
  const payload = params.toString();
  const hashedPayload = await hash(payload);

  const canonicalRequest = [
    'POST',
    path,
    '',
    `content-type:application/x-www-form-urlencoded`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    '',
    'content-type;host;x-amz-date',
    hashedPayload,
  ].join('\n');

  const credentialScope = `${dateStamp}/${AWS_REGION}/sqs/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await hash(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    'sqs'
  );

  const signature = await hmac(signingKey, stringToSign, 'hex');

  const authorizationHeader = [
    'AWS4-HMAC-SHA256 Credential=' + AWS_ACCESS_KEY_ID + '/' + credentialScope,
    'SignedHeaders=content-type;host;x-amz-date',
    'Signature=' + signature,
  ].join(', ');

  const response = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Host: host,
      'X-Amz-Date': amzDate,
      Authorization: authorizationHeader,
    },
    body: payload,
  });

  const text = await response.text();

  if (!response.ok) {
    return new Response(`Error sending message to SQS:\n${text}`, { status: 500 });
  }

  return new Response('Message sent to SQS!', { status: 200 });
}

// Function to receive and delete a message from SQS
async function processMessageFromSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const endpoint = new URL(QUEUE_URL);
  const host = endpoint.host;

  // Receive a message
  const receiveParams = new URLSearchParams({
    Action: 'ReceiveMessage',
    MaxNumberOfMessages: '1',
    WaitTimeSeconds: '10',
    Version: '2012-11-05',
  });

  const receiveResponse = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Host: host,
      'X-Amz-Date': amzDate,
      Authorization: await getAuthorizationHeader(receiveParams, amzDate, dateStamp, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, host),
    },
    body: receiveParams.toString(),
  });

  const receiveText = await receiveResponse.text();
  if (!receiveResponse.ok) {
    return new Response(`Error receiving message from SQS:\n${receiveText}`, { status: 500 });
  }

  const message = parseMessage(receiveText); // Implement a function to parse the XML response
  if (message) {
    console.log('Processing message:', message.Body);

    // Delete the message after processing
    const deleteParams = new URLSearchParams({
      Action: 'DeleteMessage',
      ReceiptHandle: message.ReceiptHandle,
      Version: '2012-11-05',
    });

    const deleteResponse = await fetch(QUEUE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: host,
        'X-Amz-Date': amzDate,
        Authorization: await getAuthorizationHeader(deleteParams, amzDate, dateStamp, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, host),
      },
      body: deleteParams.toString(),
    });

    if (!deleteResponse.ok) {
      return new Response(`Error deleting message from SQS:\n${await deleteResponse.text()}`, { status: 500 });
    }

    return new Response('Message processed and deleted from SQS!', { status: 200 });
  }

  return new Response('No messages to process.', { status: 200 });
}

// Helper function to generate the Authorization header
async function getAuthorizationHeader(params, amzDate, dateStamp, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, host) {
  const payload = params.toString();
  const hashedPayload = await hash(payload);

  const canonicalRequest = [
    'POST',
    new URL(QUEUE_URL).pathname,
    '',
    `content-type:application/x-www-form-urlencoded`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    '',
    'content-type;host;x-amz-date',
    hashedPayload,
  ].join('\n');

  const credentialScope = `${dateStamp}/${AWS_REGION}/sqs/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await hash(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    'sqs'
  );

  const signature = await hmac(signingKey, stringToSign, 'hex');

  return [
    'AWS4-HMAC-SHA256 Credential=' + AWS_ACCESS_KEY_ID + '/' + credentialScope,
    'SignedHeaders=content-type;host;x-amz-date',
    'Signature=' + signature,
  ].join(', ');
}*/

import { AwsClient } from 'aws4fetch';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  console.log('Received request:', request.method, request.url);
const aws = new AwsClient({
  accessKeyId: 'AKIA57JRPEXWCQFPB4NS',
  secretAccessKey: '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',
  service: 'sqs',
  region: 'us-east-2' // like 'us-east-1'
});
    const sqsUrl = 'https://sqs.us-east-2.amazonaws.com/960565814764/my-test-queue';
    const payload = {
      Action: 'SendMessage',
      MessageBody: 'this is my worker',
      Version: '2012-11-05'
    };

    const response = await aws.fetch(sqsUrl, {
      method: 'POST',
      body: new URLSearchParams(payload)
    });

    return new Response('Message sent to SQS!', { status: 200 });
  }


// Utility functions (hash, hmac, getSignatureKey, hmacText) remain unchanged

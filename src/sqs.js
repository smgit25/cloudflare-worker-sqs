import {hash, hmac, getSignatureKey} from './utils.js';

const AWS_REGION = 'us-east-2';
const QUEUE_URL = 'https://sqs.us-east-2.amazonaws.com/960565814764/my-test-queue';

export async function sendMessageToSQS() {
  const currentDate = new Date();
  const amzDate = currentDate.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const endpoint = new URL(QUEUE_URL);
  const host = endpoint.host;
  const path = endpoint.pathname;

  const params = new URLSearchParams({
    Action: 'SendMessage',
    MessageBody: JSON.stringify({ message: 'Hello refactored2 from Cloudflare Worker!' }),
    Version: '2012-11-05',
  });

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
    env.AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    'sqs'
  );

  const signature = await hmac(signingKey, stringToSign, 'hex');

  const authorizationHeader = [
    'AWS4-HMAC-SHA256 Credential=' + env.AWS_ACCESS_KEY_ID + '/' + credentialScope,
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
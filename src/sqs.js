import { 
  hash, 
  hmac, 
  getSignatureKey, 
  AWS_REGION, 
  QUEUE_URL, 
  API_VERSION, 
  createCanonicalRequest 
} from './utils.js';

export async function sendMessageToSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, action, messageBody) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const endpoint = new URL(QUEUE_URL);
  const host = endpoint.host;
  const path = endpoint.pathname;

  const params = new URLSearchParams({
    Action: action, // Pass the action dynamically
    MessageBody: JSON.stringify(messageBody), // Pass the message body dynamically
    Version: API_VERSION, // Use the API version from utils.js
  });

  const payload = params.toString();
  const hashedPayload = await hash(payload);

  // Use the createCanonicalRequest function from utils.js
  const canonicalRequest = createCanonicalRequest(path, host, amzDate, hashedPayload);

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
      'Content-Type': CONTENT_TYPE, // Use content-type from utils.js
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
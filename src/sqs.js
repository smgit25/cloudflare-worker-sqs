const AWS_REGION = 'us-east-2';
const QUEUE_URL = 'https://sqs.us-east-2.amazonaws.com/960565814764/my-test-queue';

export async function sendMessageToSQS(now, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) {
  const { amzDate, dateStamp } = getAmzDates(now);
  const { host, path } = getEndpointDetails(QUEUE_URL);

  const params = new URLSearchParams({
    Action: 'SendMessage',
    MessageBody: JSON.stringify({ message: 'Hello from Cloudflare Worker!' }),
    Version: '2012-11-05',
  });

  const payload = params.toString();
  const hashedPayload = await hash(payload);

  const canonicalRequest = createCanonicalRequest(path, host, amzDate, hashedPayload);
  const credentialScope = `${dateStamp}/${AWS_REGION}/sqs/aws4_request`;
  const stringToSign = createStringToSign(amzDate, credentialScope, canonicalRequest);

  const signingKey = await getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    'sqs'
  );

  const signature = await hmac(signingKey, stringToSign, 'hex');
  const authorizationHeader = createAuthorizationHeader(
    AWS_ACCESS_KEY_ID,
    credentialScope,
    signature
  );

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

// Utility function to get Amazon date formats
function getAmzDates(now) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD
  return { amzDate, dateStamp };
}

// Utility function to get endpoint details
function getEndpointDetails(queueUrl) {
  const endpoint = new URL(queueUrl);
  return { host: endpoint.host, path: endpoint.pathname };
}

// Utility function to create a canonical request
function createCanonicalRequest(path, host, amzDate, hashedPayload) {
  return [
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
}

// Utility function to create a string to sign
async function createStringToSign(amzDate, credentialScope, canonicalRequest) {
  return [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await hash(canonicalRequest),
  ].join('\n');
}

// Utility function to create an authorization header
function createAuthorizationHeader(AWS_ACCESS_KEY_ID, credentialScope, signature) {
  return [
    'AWS4-HMAC-SHA256 Credential=' + AWS_ACCESS_KEY_ID + '/' + credentialScope,
    'SignedHeaders=content-type;host;x-amz-date',
    'Signature=' + signature,
  ].join(', ');
}

// Utility functions using Web Crypto API
async function hash(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key, message, encoding = 'hex') {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return [...new Uint8Array(signature)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmacText('AWS4' + key, dateStamp);
  const kRegion = await hmacText(kDate, regionName);
  const kService = await hmacText(kRegion, serviceName);
  const kSigning = await hmacText(kService, 'aws4_request');
  return kSigning;
}

async function hmacText(key, text) {
  return await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(cryptoKey => crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(text)))
    .then(buffer => new Uint8Array(buffer));
}
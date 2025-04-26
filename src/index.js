export default {
  async fetch(request, env, ctx) {
    const now = new Date();
    const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
    const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
    
    // New part: get the x-request-id header
    const requestId = request.headers.get('x-request-id');
    
    // Only continue if x-request-id is exactly 'test'
    if (requestId == 'test') {
      // Format: 20250420T123456Z
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

      const endpoint = new URL(QUEUE_URL);
      const host = endpoint.host;
      const path = endpoint.pathname;

      const params = new URLSearchParams({
        Action: 'SendMessage',
        MessageBody: JSON.stringify({ message: 'Hello from Cloudflare Worker!' }),
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
    } else {
      // If x-request-id is missing or not 'test'
      return new Response('Invalid or Missing x-request-id', { status: 400 });
    }
  },
};

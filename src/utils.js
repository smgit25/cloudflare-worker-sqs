// Utility function to hash a message
export async function hash(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Utility function to create a canonical request
  export function createCanonicalRequest(path, host, amzDate, hashedPayload) {
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
  export async function createStringToSign(amzDate, credentialScope, canonicalRequest) {
    return [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await hash(canonicalRequest),
    ].join('\n');
  }
  
  // Utility function to generate the signing key
  export async function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = await hmac(`AWS4${key}`, dateStamp);
    const kRegion = await hmac(kDate, regionName);
    const kService = await hmac(kRegion, serviceName);
    const kSigning = await hmac(kService, 'aws4_request');
    return kSigning;
  }
  
  // Utility function to perform HMAC
  export async function hmac(key, message, encoding = 'hex') {
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
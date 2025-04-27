export async function hash(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

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

  export async function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = await hmacText('AWS4' + key, dateStamp);
    const kRegion = await hmacText(kDate, regionName);
    const kService = await hmacText(kRegion, serviceName);
    const kSigning = await hmacText(kService, 'aws4_request');
    return kSigning;
  }

  export async function hmacText(key, text) {
    return await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? new TextEncoder().encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(cryptoKey => crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(text)))
      .then(buffer => new Uint8Array(buffer));
  }
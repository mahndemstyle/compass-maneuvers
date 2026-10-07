// Share codes: "CM1:" + base64url(gzip(JSON [{n, h}])). Used by the Harbor and code-maker.html.
const ShareCode = (() => {
  const CODE_PREFIX = 'CM1:';

  async function pipe(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(text) {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function make(list) {
    const json = JSON.stringify(list.map((g) => ({ n: g.name, h: g.html })));
    return CODE_PREFIX + toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')));
  }

  async function read(code) {
    const body = code.replace(/\s+/g, '');
    if (!body.startsWith(CODE_PREFIX)) throw new Error('prefix');
    const bytes = await pipe(fromBase64Url(body.slice(CODE_PREFIX.length)), new DecompressionStream('gzip'));
    const list = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(list)) throw new Error('shape');
    return list
      .filter((e) => e && typeof e.h === 'string')
      .map((e) => ({ name: String(e.n || 'Untitled game').slice(0, 120), html: e.h }));
  }

  return { make, read };
})();

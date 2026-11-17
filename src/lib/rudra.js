import { YUME } from './http.js';

const hex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    let t = (state += 1831565813);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mirrors the signing routine in YumeZone's player bundle.
function makeSalt(timestamp) {
  const a = seededRandom(20260620);
  const b = seededRandom(98765432);
  let left = '';
  let right = '';
  for (let i = 0; i < 20; i++) {
    left += String.fromCharCode(33 + Math.floor(a() * 90));
    right += String.fromCharCode(33 + Math.floor(b() * 90));
  }
  const mask = (timestamp ^ 8272540);
  const mixed = [...left].map((ch, i) =>
    String.fromCharCode(ch.charCodeAt(0) ^ ((mask >> (i % 16)) & 7))
  ).join('');
  return `${mixed}:${right}`;
}

export async function createRudraCredentials(animeId, episode, timestamp = Math.floor(Date.now() / 1000)) {
  const source = `${animeId}:${episode}:${timestamp}:${makeSalt(timestamp)}`
    .split('').reverse().join('') + '_yume';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const sig = hex(new Uint8Array(digest));
  const client_cipher_token = Buffer.from([...sig].reverse().join(''), 'utf8').toString('base64');
  return { sig, ts: timestamp, client_cipher_token };
}

export function decryptRudraEnvelope(ciphertext, signature) {
  const encrypted = Buffer.from(ciphertext, 'base64');
  const key = Buffer.from(signature, 'utf8');
  if (!key.length) throw new Error('Empty Rudra signature');
  const decoded = Buffer.allocUnsafe(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decoded[i] = encrypted[i] ^ key[i % key.length] ^ ((i * 3) % 256);
  }
  return JSON.parse(decoded.toString('utf8'));
}

export async function requestRudraSources({ id, ep, language = 'hindi' }) {
  const credentials = await createRudraCredentials(String(id), Number(ep));
  const payload = {
    anime_id: String(id),
    episode_number: Number(ep),
    language,
    provider: 'Rudra',
    ...credentials
  };

  const response = await fetch(`${YUME}/api/yume/watch/sources`, {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'application/json',
      'content-type': 'application/json',
      origin: YUME,
      referer: `${YUME}/watch/${id}/${ep}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Rudra source endpoint returned non-JSON (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Rudra source endpoint HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const encrypted = data?.ct || data?.encrypted;
  if (encrypted) {
    try {
      data = decryptRudraEnvelope(encrypted, credentials.sig);
    } catch (error) {
      throw new Error(`Could not decrypt Rudra response: ${error.message}`);
    }
  }

  return { data, request: { ...payload, sig: undefined, client_cipher_token: undefined }, credentials };
}

export async function fetchRudraPlaylist(pathOrUrl, episodeUrl) {
  const url = new URL(pathOrUrl, YUME).href;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
      referer: episodeUrl
    }
  });
  const playlist = await response.text();
  if (!response.ok) throw new Error(`Rudra playlist HTTP ${response.status}`);
  if (!playlist.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`Rudra source did not return an HLS playlist (${response.status})`);
  }
  return { url, playlist };
}

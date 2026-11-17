import { Router } from 'express';
import { YUME } from '../lib/http.js';
import { parseHls } from '../lib/hls.js';
import { requestRudraSources, fetchRudraPlaylist } from '../lib/rudra.js';

const r = Router();
const RUDRA_PROVIDER = 'Rudra';

const valid = (id, ep) => {
  const animeId = Number(id);
  const episode = Number(ep);
  return String(id ?? '').trim() !== '' &&
    Number.isSafeInteger(animeId) && animeId > 0 &&
    String(ep ?? '').trim() !== '' &&
    Number.isSafeInteger(episode) && episode > 0;
};

r.get('/watch', (req, res) => {
  const { id, ep } = req.query;
  if (!valid(id, ep)) {
    return res.status(400).json({ success: false, error: 'id and ep must be positive numbers' });
  }
  res.json({
    success: true,
    anime_id: String(id),
    episode_number: Number(ep),
    provider: RUDRA_PROVIDER,
    watch_url: `${YUME}/watch/${id}/${ep}`,
    source_endpoint: `${YUME}/api/yume/watch/sources`
  });
});

// Rudra-only availability check. Use /extract to fetch the live provider response.
r.get('/servers', async (req, res) => {
  const { id, ep } = req.query;
  if (!valid(id, ep)) {
    return res.status(400).json({ success: false, error: 'id and ep must be positive numbers' });
  }
  try {
    const response = await fetch(`${YUME}/watch/${id}/${ep}`, {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' }
    });
    const html = await response.text();
    res.status(response.ok ? 200 : 502).json({
      success: response.ok,
      anime_id: String(id),
      episode_number: Number(ep),
      watch_url: `${YUME}/watch/${id}/${ep}`,
      provider: RUDRA_PROVIDER,
      provider_only: true,
      page_status: response.status,
      page_bytes: html.length,
      extraction_endpoint: 'POST /api/extract',
      note: 'This checks page availability only. POST /api/extract obtains Rudra source data and discovers actual audio/subtitle tracks.'
    });
  } catch (error) {
    res.status(502).json({ success: false, provider: RUDRA_PROVIDER, error: error.message });
  }
});

r.post('/extract', async (req, res) => {
  const { id, ep, language = 'hindi', include_playlist = true } = req.body || {};
  if (!valid(id, ep)) {
    return res.status(400).json({ success: false, error: 'id and ep are required and must be positive numbers' });
  }
  try {
    const { data, credentials } = await requestRudraSources({ id, ep, language });
    if (data?.available === false) {
      return res.status(404).json({ success: false, provider: RUDRA_PROVIDER, language, source: data });
    }

    const episodeUrl = `${YUME}/watch/${id}/${ep}`;
    const source = (data?.hls_sources || []).find((item) => item?.file || item?.url);
    const sourcePath = source?.file || source?.url || data?.video_link;
    let playlistInfo = null;
    let parsed = { audio: [], subtitles: [], variants: [], segments: [], isMaster: false };

    if (include_playlist && sourcePath) {
      playlistInfo = await fetchRudraPlaylist(sourcePath, episodeUrl);
      parsed = parseHls(playlistInfo.playlist, playlistInfo.url);
    }

    const sourceSubtitles = Array.isArray(data?.subtitles) ? data.subtitles : [];
    const subtitleTracks = [
      ...parsed.subtitles,
      ...sourceSubtitles.map((s) => typeof s === 'string' ? { url: s } : s)
    ];

    res.json({
      success: true,
      provider: RUDRA_PROVIDER,
      anime_id: String(id),
      episode_number: Number(ep),
      requested_language: language,
      source_type: data?.source_type || 'hls',
      available: data?.available ?? true,
      anime_name: data?.anime_name || null,
      hls_url: playlistInfo?.url || (sourcePath ? new URL(sourcePath, YUME).href : null),
      audio_tracks: parsed.audio,
      subtitles: subtitleTracks,
      variants: parsed.variants,
      intro: data?.intro || null,
      outro: data?.outro || null,
      playlist: include_playlist ? playlistInfo?.playlist || null : undefined,
      playlist_key: data?.playlist_key || null,
      provider_capabilities: data?.provider_capabilities?.[RUDRA_PROVIDER] || { hls: true, embed: false },
      request: { language, provider: RUDRA_PROVIDER, timestamp: credentials.ts },
      note: parsed.audio.length
        ? 'Audio tracks were read from Rudra’s live HLS master playlist.'
        : 'Rudra source decrypted successfully, but no audio rendition declarations were found in the fetched playlist.'
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      provider: RUDRA_PROVIDER,
      language,
      error: error.message
    });
  }
});

r.post('/parse-hls', (req, res) => {
  const { playlist, url } = req.body || {};
  if (typeof playlist !== 'string' || !url) {
    return res.status(400).json({ success: false, error: 'playlist and url are required' });
  }
  try {
    res.json({ success: true, provider: RUDRA_PROVIDER, ...parseHls(playlist, url) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default r;

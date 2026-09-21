/**
 * Vercel Serverless Function: Dynamic Sitemap Generator
 * Route: /api/sitemap (or /sitemap.xml via vercel.json rewrite)
 * Dynamically queries TMDB & Firebase RTDB, responds with XML and edge caching headers.
 */

const https = require('https');

const TMDB_API_KEY = 'a7711beafce9089f9791fc2a4c3a2b60';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const FIREBASE_RTDB_URL = 'https://net-mirror-bd-ftp-default-rtdb.asia-southeast1.firebasedatabase.app';
const FALLBACK_SITE_URL = 'https://streamflixbd.vercel.app';

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'StreamFlix-Vercel-Sitemap/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn(`[Sitemap] Fetch error: ${url}`, err.message);
      resolve(null);
    });
  });
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(d) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (!d) return todayStr;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return todayStr;
    const year = date.getUTCFullYear();
    // Valid lastmod for Google: cannot be a historical pre-web release date (e.g. 1957, 1952)
    // and cannot be in the future. Clamped strictly between 2024 and today.
    if (year < 2024 || date.getTime() > Date.now()) {
      return todayStr;
    }
    return date.toISOString().split('T')[0];
  } catch {
    return todayStr;
  }
}

module.exports = async function handler(req, res) {
  const today = formatDate();

  // 1. Determine site base URL dynamically from request headers
  let baseUrl = FALLBACK_SITE_URL;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    if (host && !host.includes('localhost')) {
      baseUrl = `${proto}://${host}`;
    } else {
      const settings = await fetchJson(`${FIREBASE_RTDB_URL}/site_settings.json`);
      if (settings && settings.siteUrl) {
        baseUrl = settings.siteUrl.replace(/\/+$/, '');
      }
    }
  } catch (e) {
    // fallback
  }

  const urls = new Map();

  function addUrl(path, priority = '0.7', changefreq = 'weekly', lastmod = today, image = null, title = null) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (!urls.has(cleanPath)) {
      urls.set(cleanPath, {
        loc: `${baseUrl}${cleanPath}`,
        lastmod: formatDate(lastmod),
        changefreq,
        priority,
        image,
        title
      });
    }
  }

  // Core Static Pages
  addUrl('/', '1.0', 'daily', today);
  addUrl('/movies', '0.9', 'daily', today);
  addUrl('/tv', '0.9', 'daily', today);
  addUrl('/trending', '0.9', 'daily', today);
  addUrl('/popular', '0.9', 'daily', today);
  addUrl('/top-rated', '0.8', 'weekly', today);
  addUrl('/upcoming', '0.8', 'daily', today);
  addUrl('/search', '0.7', 'weekly', today);

  // TMDB & Firebase parallel queries
  try {
    const [
      movieGenresRes,
      tvGenresRes,
      trendingMovies,
      popularMovies,
      trendingTv,
      popularTv,
      adminMediaData
    ] = await Promise.all([
      fetchJson(`${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/genre/tv/list?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${FIREBASE_RTDB_URL}/admin_media.json`)
    ]);

    // Genres
    if (movieGenresRes && Array.isArray(movieGenresRes.genres)) {
      for (const g of movieGenresRes.genres) {
        addUrl(`/genre/movie/${g.id}/${encodeURIComponent(g.name)}`, '0.7', 'weekly', today);
      }
    }
    if (tvGenresRes && Array.isArray(tvGenresRes.genres)) {
      for (const g of tvGenresRes.genres) {
        addUrl(`/genre/tv/${g.id}/${encodeURIComponent(g.name)}`, '0.7', 'weekly', today);
      }
    }

    // Movies
    const movies = [...(trendingMovies?.results || []), ...(popularMovies?.results || [])];
    const seenMovies = new Set();
    for (const m of movies) {
      if (!m || !m.id || seenMovies.has(m.id)) continue;
      seenMovies.add(m.id);
      const title = m.title || m.original_title || 'Movie';
      const img = m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : null;
      const mod = m.release_date || today;
      addUrl(`/movie/${m.id}`, '0.8', 'weekly', mod, img, title);
      addUrl(`/movie/${m.id}/watch`, '0.8', 'weekly', mod, img, `Watch ${title} Online Free`);
    }

    // TV Series
    const tvs = [...(trendingTv?.results || []), ...(popularTv?.results || [])];
    const seenTv = new Set();
    for (const t of tvs) {
      if (!t || !t.id || seenTv.has(t.id)) continue;
      seenTv.add(t.id);
      const title = t.name || t.original_name || 'TV Series';
      const img = t.poster_path ? `https://image.tmdb.org/t/p/w780${t.poster_path}` : null;
      const mod = t.first_air_date || today;
      addUrl(`/tv/${t.id}`, '0.8', 'weekly', mod, img, title);
      addUrl(`/tv/${t.id}/watch`, '0.8', 'weekly', mod, img, `Watch ${title} Online Free`);
    }

    // Custom Admin Media
    if (adminMediaData && typeof adminMediaData === 'object') {
      for (const item of Object.values(adminMediaData)) {
        if (!item || item.published === false || item.draft === true) continue;
        const type = item.mediaType === 'tv' ? 'tv' : 'movie';
        const id = item.id;
        if (!id) continue;
        const mod = item.addedAt ? formatDate(item.addedAt) : today;
        const title = item.seoTitle || `${type.toUpperCase()} #${id}`;
        const img = item.customPoster || item.seoImage || null;
        addUrl(`/${type}/${id}`, '0.85', 'weekly', mod, img, title);
        addUrl(`/${type}/${id}/watch`, '0.85', 'weekly', mod, img, `Watch ${title}`);
      }
    }
  } catch (e) {
    console.warn('[Sitemap Handler] Error during fetch:', e);
  }

  // Generate XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  for (const item of urls.values()) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
    xml += `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n`;
    xml += `    <changefreq>${escapeXml(item.changefreq)}</changefreq>\n`;
    xml += `    <priority>${escapeXml(item.priority)}</priority>\n`;
    if (item.image) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(item.image)}</image:loc>\n`;
      if (item.title) {
        xml += `      <image:title>${escapeXml(item.title)}</image:title>\n`;
      }
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }
  xml += `</urlset>\n`;

  // Respond with XML
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
};

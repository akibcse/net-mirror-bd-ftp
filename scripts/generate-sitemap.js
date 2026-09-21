/**
 * Dynamic Sitemap Generator for StreamFlix
 * Fetches latest movies, TV series, genres from TMDB and custom media from Firebase RTDB.
 * Outputs XML directly to public/sitemap.xml
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const TMDB_API_KEY = 'a7711beafce9089f9791fc2a4c3a2b60';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const FIREBASE_RTDB_URL = 'https://net-mirror-bd-ftp-default-rtdb.asia-southeast1.firebasedatabase.app';
const FALLBACK_SITE_URL = 'https://streamflixbd.vercel.app';

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'StreamFlix-Sitemap-Generator/1.0' } }, (res) => {
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
      console.warn(`[Sitemap] Fetch error for ${url}:`, err.message);
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

async function generateSitemap() {
  console.log('🚀 Generating dynamic sitemap.xml...');
  const today = formatDate();

  // 1. Determine site base URL (from process.env.SITE_URL or FALLBACK_SITE_URL)
  let baseUrl = (process.env.SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
  console.log(`🌐 Base URL: ${baseUrl}`);

  const urls = new Map(); // key: path, val: { loc, lastmod, changefreq, priority, image, title }

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

  // 2. Core Static Pages
  addUrl('/', '1.0', 'daily', today);
  addUrl('/movies', '0.9', 'daily', today);
  addUrl('/tv', '0.9', 'daily', today);
  addUrl('/trending', '0.9', 'daily', today);
  addUrl('/popular', '0.9', 'daily', today);
  addUrl('/top-rated', '0.8', 'weekly', today);
  addUrl('/upcoming', '0.8', 'daily', today);
  addUrl('/search', '0.7', 'weekly', today);

  // 3. Fetch Genres from TMDB
  try {
    const [movieGenresRes, tvGenresRes] = await Promise.all([
      fetchJson(`${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/genre/tv/list?api_key=${TMDB_API_KEY}`)
    ]);

    if (movieGenresRes && Array.isArray(movieGenresRes.genres)) {
      for (const g of movieGenresRes.genres) {
        const encodedName = encodeURIComponent(g.name);
        addUrl(`/genre/movie/${g.id}/${encodedName}`, '0.7', 'weekly', today);
      }
    }

    if (tvGenresRes && Array.isArray(tvGenresRes.genres)) {
      for (const g of tvGenresRes.genres) {
        const encodedName = encodeURIComponent(g.name);
        addUrl(`/genre/tv/${g.id}/${encodedName}`, '0.7', 'weekly', today);
      }
    }
  } catch (e) {
    console.warn('[Sitemap] Error fetching genres:', e.message);
  }

  // 4. Fetch Media Items (Trending, Popular, Top Rated Movies & TV)
  try {
    const [
      trendingMovies,
      popularMovies1,
      popularMovies2,
      topRatedMovies,
      upcomingMovies,
      trendingTv,
      popularTv1,
      popularTv2,
      topRatedTv
    ] = await Promise.all([
      fetchJson(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=2`),
      fetchJson(`${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`),
      fetchJson(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=1`),
      fetchJson(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=2`),
      fetchJson(`${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}&page=1`)
    ]);

    const allMovies = [
      ...(trendingMovies?.results || []),
      ...(popularMovies1?.results || []),
      ...(popularMovies2?.results || []),
      ...(topRatedMovies?.results || []),
      ...(upcomingMovies?.results || [])
    ];

    const allTv = [
      ...(trendingTv?.results || []),
      ...(popularTv1?.results || []),
      ...(popularTv2?.results || []),
      ...(topRatedTv?.results || [])
    ];

    const seenMovieIds = new Set();
    for (const m of allMovies) {
      if (!m || !m.id || seenMovieIds.has(m.id)) continue;
      seenMovieIds.add(m.id);

      const title = m.title || m.original_title || 'Movie';
      const img = m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : (m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null);
      const mod = m.release_date || today;

      // Detail page & watch page
      addUrl(`/movie/${m.id}`, '0.8', 'weekly', mod, img, title);
      addUrl(`/movie/${m.id}/watch`, '0.8', 'weekly', mod, img, `Watch ${title} Online Free`);
    }

    const seenTvIds = new Set();
    for (const t of allTv) {
      if (!t || !t.id || seenTvIds.has(t.id)) continue;
      seenTvIds.add(t.id);

      const title = t.name || t.original_name || 'TV Series';
      const img = t.poster_path ? `https://image.tmdb.org/t/p/w780${t.poster_path}` : (t.backdrop_path ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}` : null);
      const mod = t.first_air_date || today;

      // Detail page & watch page
      addUrl(`/tv/${t.id}`, '0.8', 'weekly', mod, img, title);
      addUrl(`/tv/${t.id}/watch`, '0.8', 'weekly', mod, img, `Watch ${title} Online Free`);
    }
  } catch (e) {
    console.warn('[Sitemap] Error fetching TMDB media:', e.message);
  }

  // 5. Fetch Custom/Admin Media from Firebase RTDB
  try {
    const adminMediaData = await fetchJson(`${FIREBASE_RTDB_URL}/admin_media.json`);
    if (adminMediaData && typeof adminMediaData === 'object') {
      const items = Object.values(adminMediaData);
      for (const item of items) {
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
    console.warn('[Sitemap] Error fetching Firebase admin media:', e.message);
  }

  // 6. Build XML String
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

  // 7. Write to public/sitemap.xml
  const publicDir = path.resolve(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');

  console.log(`✅ Dynamic sitemap created successfully!`);
  console.log(`📄 Total indexable URLs: ${urls.size}`);
  console.log(`📍 Output file: ${outputPath}`);

  return { total: urls.size, path: outputPath };
}

if (require.main === module) {
  generateSitemap().catch(err => {
    console.error('❌ Sitemap generation failed:', err);
    process.exit(1);
  });
}

module.exports = { generateSitemap };

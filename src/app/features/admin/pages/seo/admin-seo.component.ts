import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { SettingsService } from '../../../../services/settings.service';
import { MovieService } from '../../../../services/movie.service';
import { AdminMediaService } from '../../../../services/admin-media.service';

interface SitemapStats {
  total: number;
  movies: number;
  tv: number;
  genres: number;
  staticPages: number;
  generatedAt: string;
}

@Component({
  selector: 'app-admin-seo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1>SEO & Search Engine Optimization</h1>
          <p>Configure global metadata, search engine indexing, sitemaps, and Google Search Console integration.</p>
        </div>
        <button class="btn-primary" (click)="saveSeo()" [disabled]="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

      <div *ngIf="successMsg" class="alert-success">✓ {{ successMsg }}</div>
      <div *ngIf="errorMsg" class="alert-error">⚠️ {{ errorMsg }}</div>

      <!-- ── Google Search Console & Dynamic Sitemap Section ── -->
      <div class="sitemap-banner">
        <div class="sitemap-header">
          <div class="sitemap-title-group">
            <div class="icon-wrap">🗺️</div>
            <div>
              <h2>Dynamic XML Sitemap & Google Search Console</h2>
              <p>Dynamic sitemap indexing for all movie pages, TV shows, watch links, and genres.</p>
            </div>
          </div>
          <span class="badge-active">● Active & Auto-Generated</span>
        </div>

        <div class="sitemap-content">
          <div class="sitemap-url-box">
            <span class="url-label">Your Live Sitemap URL:</span>
            <div class="url-row">
              <input type="text" readonly [value]="sitemapUrl" class="sitemap-input" #sitemapInput />
              <button class="btn-action btn-copy" (click)="copySitemapUrl(sitemapInput)">
                {{ copied ? '✓ Copied!' : '📋 Copy URL' }}
              </button>
              <a [href]="sitemapUrl" target="_blank" rel="noopener" class="btn-action btn-view">
                ↗ Test Live XML
              </a>
            </div>
            <span class="hint">Submit this exact URL into Google Search Console for comprehensive indexing.</span>
          </div>

          <div class="sitemap-actions">
            <button class="btn-secondary" (click)="generateClientSitemap()" [disabled]="generatingSitemap">
              <span *ngIf="!generatingSitemap">⚡ Generate & Inspect Live Sitemap</span>
              <span *ngIf="generatingSitemap">⏳ Fetching live data...</span>
            </button>

            <button class="btn-secondary" (click)="downloadSitemapXml()" [disabled]="!generatedXml">
              💾 Download sitemap.xml
            </button>

            <a href="https://search.google.com/search-console/sitemaps" target="_blank" rel="noopener" class="btn-gsc">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; margin-right:6px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              Open Google Search Console
            </a>
          </div>

          <!-- Sitemap Live Stats -->
          <div *ngIf="sitemapStats" class="stats-grid">
            <div class="stat-card">
              <span class="stat-num">{{ sitemapStats.total }}</span>
              <span class="stat-label">Total Indexable URLs</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ sitemapStats.movies }}</span>
              <span class="stat-label">Movie Detail & Watch Pages</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ sitemapStats.tv }}</span>
              <span class="stat-label">TV Series & Watch Pages</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ sitemapStats.genres }}</span>
              <span class="stat-label">Genre Category Pages</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">{{ sitemapStats.staticPages }}</span>
              <span class="stat-label">Core Static Pages</span>
            </div>
          </div>

          <!-- XML Preview Box -->
          <div *ngIf="generatedXml" class="xml-preview-box">
            <div class="preview-header">
              <span>XML Preview (First 50 lines)</span>
              <button class="btn-text" (click)="generatedXml = ''">✕ Close Preview</button>
            </div>
            <pre class="xml-snippet"><code>{{ xmlSnippet }}</code></pre>
          </div>

          <!-- Step-by-step submission guide -->
          <div class="guide-box">
            <h4>📌 How to Submit to Google Search Console (30 Seconds):</h4>
            <ol>
              <li>Click <strong>"Open Google Search Console"</strong> above (or visit <a href="https://search.google.com/search-console" target="_blank" rel="noopener">search.google.com/search-console</a>).</li>
              <li>Select your property (e.g. <code>{{ seo.siteUrl }}</code>).</li>
              <li>In the left sidebar, click <strong>"Sitemaps"</strong> under the Indexing section.</li>
              <li>Under <em>"Add a new sitemap"</em>, simply type <code>sitemap.xml</code> and click <strong>Submit</strong>.</li>
              <li>Googlebot will automatically crawl your site, detect all movies and series, and index them in search results!</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- ── Metadata Configuration Grid ── -->
      <div class="form-grid">
        <div class="form-card">
          <h3>Global Meta Tags</h3>

          <div class="form-group">
            <label>Default Page Title</label>
            <input type="text" [(ngModel)]="seo.defaultTitle" class="form-control" />
            <span class="hint">Shown when no custom page title is active</span>
          </div>

          <div class="form-group">
            <label>Default Meta Description</label>
            <textarea [(ngModel)]="seo.defaultDescription" rows="3" class="form-control"></textarea>
            <span class="hint">Recommended under 160 characters for search snippet display</span>
          </div>

          <div class="form-group">
            <label>Global Meta Keywords</label>
            <input type="text" [(ngModel)]="seo.keywords" class="form-control" placeholder="movies, watch online, hd streaming, tv series" />
          </div>
        </div>

        <div class="form-card">
          <h3>Social Sharing & Canonical Domain</h3>

          <div class="form-group">
            <label>Canonical Site Domain</label>
            <input type="text" [(ngModel)]="seo.siteUrl" class="form-control" placeholder="https://ott.akibhasan.online" />
            <span class="hint">Base domain used for sitemap URLs, canonical links, and Open Graph tags.</span>
          </div>

          <div class="form-group">
            <label>Open Graph Default Image URL</label>
            <input type="text" [(ngModel)]="seo.ogImage" class="form-control" placeholder="https://..." />
          </div>

          <div class="form-group">
            <label>Twitter / X Creator Handle</label>
            <input type="text" [(ngModel)]="seo.twitterHandle" class="form-control" placeholder="@Net Mirror BD" />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
    .page-header h1 { font-size: 1.75rem; color: #ffffff; margin: 0; }
    .page-header p { color: #94a3b8; margin: 0; font-size: 0.9rem; }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      border: none;
      padding: 0.65rem 1.35rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }

    /* Sitemap Banner */
    .sitemap-banner {
      background: linear-gradient(180deg, rgba(30, 27, 75, 0.5) 0%, rgba(17, 24, 39, 0.75) 100%);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 16px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .sitemap-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 1rem;
    }
    .sitemap-title-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .icon-wrap {
      font-size: 2rem;
      background: rgba(99, 102, 241, 0.15);
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .sitemap-header h2 { font-size: 1.25rem; color: #ffffff; margin: 0 0 0.25rem 0; }
    .sitemap-header p { color: #94a3b8; margin: 0; font-size: 0.85rem; }
    .badge-active {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .sitemap-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .sitemap-url-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .url-label { font-size: 0.85rem; color: #cbd5e1; font-weight: 600; }
    .url-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .sitemap-input {
      flex: 1;
      min-width: 280px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 8px;
      padding: 0.7rem 1rem;
      color: #a5b4fc;
      font-family: monospace;
      font-size: 0.95rem;
      outline: none;
    }
    .btn-action {
      padding: 0.7rem 1.1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .btn-copy {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
    }
    .btn-copy:hover { background: rgba(99, 102, 241, 0.35); }
    .btn-view {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .btn-view:hover { background: rgba(255, 255, 255, 0.15); }

    .sitemap-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f1f5f9;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-gsc {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      color: #ffffff;
      padding: 0.65rem 1.1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      transition: opacity 0.2s;
    }
    .btn-gsc:hover { opacity: 0.9; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .stat-card {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .stat-num { font-size: 1.4rem; font-weight: 700; color: #a5b4fc; }
    .stat-label { font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem; }

    /* Preview Box */
    .xml-preview-box {
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 1rem;
      margin-top: 0.5rem;
    }
    .preview-header {
      display: flex;
      justify-content: space-between;
      color: #cbd5e1;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .btn-text { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.8rem; }
    .btn-text:hover { color: white; }
    .xml-snippet {
      max-height: 250px;
      overflow-y: auto;
      font-size: 0.75rem;
      color: #93c5fd;
      font-family: monospace;
      margin: 0;
      white-space: pre-wrap;
    }

    /* Guide Box */
    .guide-box {
      background: rgba(0, 0, 0, 0.25);
      border-left: 3px solid #6366f1;
      border-radius: 0 8px 8px 0;
      padding: 1rem 1.25rem;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    .guide-box h4 { margin: 0 0 0.5rem 0; color: #ffffff; font-size: 0.95rem; }
    .guide-box ol { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .guide-box a { color: #93c5fd; text-decoration: underline; }

    /* Form Grid */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 800px) { .form-grid { grid-template-columns: 1fr; } }
    .form-card {
      background: rgba(17, 24, 39, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .form-card h3 { font-size: 1.15rem; color: white; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.85rem; color: #cbd5e1; font-weight: 500; }
    .form-control {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      color: white;
      outline: none;
    }
    .hint { font-size: 0.75rem; color: #64748b; }
    .alert-success { background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(34,197,94,0.25); font-weight: 500; }
    .alert-error { background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.25); font-weight: 500; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class AdminSeoComponent implements OnInit, OnDestroy {
  private readonly settings = inject(SettingsService);
  private readonly movieService = inject(MovieService);
  private readonly adminMedia = inject(AdminMediaService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;

  saving = false;
  successMsg = '';
  errorMsg = '';
  copied = false;

  generatingSitemap = false;
  generatedXml = '';
  xmlSnippet = '';
  sitemapStats?: SitemapStats;

  seo = {
    defaultTitle: 'Net Mirror BD — Watch Movies & TV Series Online Free in Full HD',
    defaultDescription: 'Stream thousands of movies and TV shows for free in HD quality. No sign-up required, multiple fast servers, and subtitle support.',
    keywords: 'movies, stream, free movies, watch online, tv series, cinema, streaming hd',
    ogImage: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=630&fit=crop',
    twitterHandle: '@netmirrorbd',
    siteUrl: 'https://ott.akibhasan.online'
  };

  get sitemapUrl(): string {
    const base = (this.seo.siteUrl || 'https://ott.akibhasan.online').replace(/\/+$/, '');
    return `${base}/sitemap.xml`;
  }

  ngOnInit(): void {
    this.sub = this.settings.settings$.subscribe(s => {
      if (!this.saving) {
        if (s.seo) this.seo = { ...this.seo, ...s.seo };
        if (s.globalSeoTitle) this.seo.defaultTitle = s.globalSeoTitle;
        if (s.globalSeoDescription) this.seo.defaultDescription = s.globalSeoDescription;
        if (s.globalOgImage) this.seo.ogImage = s.globalOgImage;
        if (s.siteUrl) this.seo.siteUrl = s.siteUrl;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  copySitemapUrl(input: HTMLInputElement): void {
    input.select();
    navigator.clipboard.writeText(this.sitemapUrl).then(() => {
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
        this.cdr.detectChanges();
      }, 3000);
      this.cdr.detectChanges();
    });
  }

  async generateClientSitemap(): Promise<void> {
    this.generatingSitemap = true;
    this.cdr.detectChanges();

    try {
      const today = new Date().toISOString().split('T')[0];
      const base = (this.seo.siteUrl || 'https://ott.akibhasan.online').replace(/\/+$/, '');
      const urlMap = new Map<string, { loc: string; lastmod: string; changefreq: string; priority: string; image?: string; title?: string }>();

      const addUrl = (p: string, priority = '0.7', changefreq = 'weekly', lastmod = today, image?: string, title?: string) => {
        const path = p.startsWith('/') ? p : `/${p}`;
        if (!urlMap.has(path)) {
          urlMap.set(path, { loc: `${base}${path}`, lastmod, changefreq, priority, image, title });
        }
      };

      // 1. Static Pages
      addUrl('/', '1.0', 'daily', today);
      addUrl('/movies', '0.9', 'daily', today);
      addUrl('/tv', '0.9', 'daily', today);
      addUrl('/trending', '0.9', 'daily', today);
      addUrl('/popular', '0.9', 'daily', today);
      addUrl('/top-rated', '0.8', 'weekly', today);
      addUrl('/upcoming', '0.8', 'daily', today);
      addUrl('/search', '0.7', 'weekly', today);
      const staticCount = urlMap.size;

      // 2. Fetch Genres
      let genreCount = 0;
      try {
        const [movieGenres, tvGenres] = await Promise.all([
          firstValueFrom(this.movieService.getGenres('movie')).catch(() => []),
          firstValueFrom(this.movieService.getGenres('tv')).catch(() => [])
        ]);
        for (const g of movieGenres) {
          addUrl(`/genre/movie/${g.id}/${encodeURIComponent(g.name)}`, '0.7', 'weekly', today);
          genreCount++;
        }
        for (const g of tvGenres) {
          addUrl(`/genre/tv/${g.id}/${encodeURIComponent(g.name)}`, '0.7', 'weekly', today);
          genreCount++;
        }
      } catch { /* ok */ }

      // 3. Fetch Movies
      let movieCount = 0;
      try {
        const [trendingM, popularM, topRatedM] = await Promise.all([
          firstValueFrom(this.movieService.getTrendingMovies('week')).catch(() => null),
          firstValueFrom(this.movieService.getPopularMovies(1)).catch(() => null),
          firstValueFrom(this.movieService.getTopRatedMovies(1)).catch(() => null)
        ]);
        const movies = [...(trendingM?.results || []), ...(popularM?.results || []), ...(topRatedM?.results || [])];
        const seenM = new Set<number>();
        for (const m of movies) {
          if (!m || !m.id || seenM.has(m.id)) continue;
          seenM.add(m.id);
          const title = m.title || 'Movie';
          const img = m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : undefined;
          addUrl(`/movie/${m.id}`, '0.8', 'weekly', m.release_date || today, img, title);
          addUrl(`/movie/${m.id}/watch`, '0.8', 'weekly', m.release_date || today, img, `Watch ${title} Online Free`);
          movieCount += 2;
        }
      } catch { /* ok */ }

      // 4. Fetch TV Series
      let tvCount = 0;
      try {
        const [trendingT, popularT, topRatedT] = await Promise.all([
          firstValueFrom(this.movieService.getTrendingTv('week')).catch(() => null),
          firstValueFrom(this.movieService.getPopularTv(1)).catch(() => null),
          firstValueFrom(this.movieService.getTopRatedTv(1)).catch(() => null)
        ]);
        const tvs = [...(trendingT?.results || []), ...(popularT?.results || []), ...(topRatedT?.results || [])];
        const seenT = new Set<number>();
        for (const t of tvs) {
          if (!t || !t.id || seenT.has(t.id)) continue;
          seenT.add(t.id);
          const title = t.name || 'TV Series';
          const img = t.poster_path ? `https://image.tmdb.org/t/p/w780${t.poster_path}` : undefined;
          addUrl(`/tv/${t.id}`, '0.8', 'weekly', t.first_air_date || today, img, title);
          addUrl(`/tv/${t.id}/watch`, '0.8', 'weekly', t.first_air_date || today, img, `Watch ${title} Online Free`);
          tvCount += 2;
        }
      } catch { /* ok */ }

      // 5. Custom Overrides from Firebase
      try {
        const overrides = await this.adminMedia.getAllOverrides();
        for (const item of overrides) {
          if (!item.published || item.draft) continue;
          const type = item.mediaType === 'tv' ? 'tv' : 'movie';
          const id = item.id;
          const img = item.customPoster || item.seoImage;
          addUrl(`/${type}/${id}`, '0.85', 'weekly', today, img, item.seoTitle);
          addUrl(`/${type}/${id}/watch`, '0.85', 'weekly', today, img, `Watch ${item.seoTitle || item.id}`);
          if (type === 'tv') tvCount += 2; else movieCount += 2;
        }
      } catch { /* ok */ }

      // Build XML
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const item of urlMap.values()) {
        xml += `  <url>\n`;
        xml += `    <loc>${this.escapeXml(item.loc)}</loc>\n`;
        xml += `    <lastmod>${item.lastmod}</lastmod>\n`;
        xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
        xml += `    <priority>${item.priority}</priority>\n`;
        if (item.image) {
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${this.escapeXml(item.image)}</image:loc>\n`;
          if (item.title) xml += `      <image:title>${this.escapeXml(item.title)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }
      xml += `</urlset>\n`;

      this.generatedXml = xml;
      const lines = xml.split('\n');
      this.xmlSnippet = lines.slice(0, 50).join('\n') + (lines.length > 50 ? '\n... [and more]' : '');

      this.sitemapStats = {
        total: urlMap.size,
        movies: movieCount,
        tv: tvCount,
        genres: genreCount,
        staticPages: staticCount,
        generatedAt: new Date().toLocaleTimeString()
      };

      this.successMsg = `✅ Dynamic sitemap generated with ${urlMap.size} indexable URLs! Ready for Google Search Console.`;
      setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 6000);
    } catch (err: any) {
      console.error('Failed to generate preview sitemap:', err);
      this.errorMsg = 'Could not generate sitemap preview: ' + (err?.message || 'Error');
    } finally {
      this.generatingSitemap = false;
      this.cdr.detectChanges();
    }
  }

  downloadSitemapXml(): void {
    if (!this.generatedXml) return;
    const blob = new Blob([this.generatedXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async saveSeo(): Promise<void> {
    this.saving = true;
    this.successMsg = '';
    this.errorMsg = '';
    this.cdr.detectChanges();
    try {
      await this.settings.saveSettings({
        seo: this.seo,
        globalSeoTitle: this.seo.defaultTitle,
        globalSeoDescription: this.seo.defaultDescription,
        globalOgImage: this.seo.ogImage,
        siteUrl: this.seo.siteUrl
      });
      this.ngZone.run(() => {
        this.successMsg = '✅ SEO & Sitemap domain settings saved and applied globally!';
        this.saving = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
      });
    } catch (err: any) {
      console.error('SEO save error:', err);
      this.ngZone.run(() => {
        this.errorMsg = '⚠️ ' + (err?.message || 'Failed to save SEO configuration.');
        this.saving = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.errorMsg = ''; this.cdr.detectChanges(); }, 5000);
      });
    }
  }
}

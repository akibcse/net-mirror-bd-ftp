import { Injectable, inject, signal, NgZone } from '@angular/core';
import { getDatabase, ref, set, get, push, remove, update } from 'firebase/database';
import { FirebaseService } from './firebase.service';
import { MovieService } from './movie.service';
import { AuthService } from './auth.service';
import {
  MediaOverride,
  StreamServerConfig,
  MediaType,
  MediaDetails,
  AdminLog,
  AutoImportCategory,
  AutoImportOptions,
  AutoImportProgress,
  AutoSyncConfig,
  MediaItem
} from '../models/media.model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminMediaService {
  private readonly firebase = inject(FirebaseService);
  private readonly movieService = inject(MovieService);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private db = getDatabase(this.firebase.app);

  // ─── Media Overrides ─────────────────────────────────────────────

  async getAllOverrides(mediaType?: MediaType): Promise<MediaOverride[]> {
    const snap = await get(ref(this.db, 'admin_media'));
    return this.zone.run(() => {
      if (!snap.exists()) return [];
      const all = Object.values(snap.val() as Record<string, MediaOverride>);
      return mediaType ? all.filter(m => m.mediaType === mediaType) : all;
    });
  }

  async getOverride(id: string, mediaType?: MediaType): Promise<MediaOverride | null> {
    const key = mediaType ? `${mediaType}_${id}` : id;
    const snap = await get(ref(this.db, `admin_media/${key}`));
    if (!snap.exists() && mediaType) {
      const snapOld = await get(ref(this.db, `admin_media/${id}`));
      return this.zone.run(() => snapOld.exists() ? snapOld.val() : null);
    }
    return this.zone.run(() => snap.exists() ? snap.val() : null);
  }

  async saveOverride(override: MediaOverride): Promise<void> {
    // Use mediaType-prefixed key to avoid movie/TV id collisions
    const key = `${override.mediaType}_${override.id}`;
    await set(ref(this.db, `admin_media/${key}`), {
      ...override,
      _key: key,
      addedAt: override.addedAt || Date.now()
    });
    await this.logAction('save_override', `${override.mediaType}:${override.id}`, JSON.stringify({ id: override.id, type: override.mediaType }));
  }

  async deleteOverride(id: string, mediaType?: MediaType): Promise<void> {
    const key = mediaType ? `${mediaType}_${id}` : id;
    await remove(ref(this.db, `admin_media/${key}`));
    // Also remove old format key if exists
    if (mediaType) {
      try { await remove(ref(this.db, `admin_media/${id}`)); } catch { /* ok */ }
    }
    await this.logAction('delete_override', id);
  }

  async toggleFeatured(id: string, mediaType: MediaType, featured: boolean): Promise<void> {
    const key = `${mediaType}_${id}`;
    await update(ref(this.db, `admin_media/${key}`), { featured, mediaType });
    // Also update old key format if it exists
    try { await update(ref(this.db, `admin_media/${id}`), { featured }); } catch { /* ok */ }
    await this.logAction('toggle_featured', id, `featured=${featured}`);
  }

  async togglePublished(id: string, mediaType: MediaType, published: boolean): Promise<void> {
    const key = `${mediaType}_${id}`;
    await update(ref(this.db, `admin_media/${key}`), { published, mediaType });
    try { await update(ref(this.db, `admin_media/${id}`), { published }); } catch { /* ok */ }
  }

  // ─── Import from TMDB ────────────────────────────────────────────

  async importFromTmdb(
    tmdbId: number,
    mediaType: MediaType,
    customFlags?: { featured?: boolean; trending?: boolean; published?: boolean }
  ): Promise<MediaOverride> {
    const details = await firstValueFrom(
      mediaType === 'movie'
        ? this.movieService.getMovieDetails(tmdbId)
        : this.movieService.getTvDetails(tmdbId)
    );

    const override: MediaOverride = {
      id: tmdbId.toString(),
      mediaType,
      title: details.title || details.name || '',
      poster_path: details.poster_path || null,
      backdrop_path: details.backdrop_path || null,
      vote_average: details.vote_average || 0,
      release_date: details.release_date || details.first_air_date || '',
      overview: details.overview || '',
      published: customFlags?.published ?? true,
      draft: false,
      featured: customFlags?.featured ?? false,
      trending: customFlags?.trending ?? false,
      addedAt: Date.now(),
      slug: this.generateSlug(details.title || details.name || ''),
      seoTitle: `${details.title || details.name} (${(details.release_date || details.first_air_date || '').substring(0, 4)})`,
      seoDescription: details.overview?.substring(0, 160)
    };

    await this.saveOverride(override);
    await this.logAction('import_tmdb', `${mediaType}:${tmdbId}`, details.title || details.name || '');
    return override;
  }

  async bulkImport(ids: number[], mediaType: MediaType): Promise<{ success: number; failed: number }> {
    let success = 0, failed = 0;
    for (const id of ids) {
      try {
        await this.importFromTmdb(id, mediaType);
        success++;
      } catch {
        failed++;
      }
    }
    return { success, failed };
  }

  // ─── Automated Import Engine ─────────────────────────────────────

  async autoImportMedia(
    options: AutoImportOptions,
    onProgress?: (progress: AutoImportProgress) => void,
    cancellationToken?: { isCancelled: boolean }
  ): Promise<AutoImportProgress> {
    const targetMediaType = options.mediaType || 'movie';
    const progress: AutoImportProgress = {
      current: 0,
      total: options.limit,
      title: '',
      posterPath: null,
      successCount: 0,
      skippedCount: 0,
      failedCount: 0,
      status: 'running',
      message: 'Preparing automated import...',
      logs: []
    };

    const emit = () => onProgress?.({ ...progress, logs: [...progress.logs] });
    emit();

    try {
      // 1. Fetch existing IDs for duplicate prevention
      progress.message = 'Checking existing library for duplicates...';
      emit();
      const existingMovies = await this.getAllOverrides('movie');
      const existingTv = await this.getAllOverrides('tv');
      const movieIds = new Set(existingMovies.map(m => m.id.toString()));
      const tvIds = new Set(existingTv.map(t => t.id.toString()));

      // 2. Fetch candidate media from TMDB API
      progress.message = `Fetching ${options.category} ${targetMediaType.toUpperCase()} from TMDB API...`;
      emit();

      type Candidate = { item: MediaItem; type: MediaType };
      const candidates: Candidate[] = [];

      // Helper to fetch movies
      const fetchMovies = async (category: string, count: number) => {
        const pagesNeeded = Math.ceil(count / 20);
        if (category === 'all') {
          const fetchers = [
            () => firstValueFrom(this.movieService.getTrendingMovies('week', 1)),
            () => firstValueFrom(this.movieService.getPopularMovies(1)),
            () => firstValueFrom(this.movieService.getTopRatedMovies(1)),
            () => firstValueFrom(this.movieService.getNowPlayingMovies(1)),
            () => firstValueFrom(this.movieService.getUpcomingMovies(1))
          ];
          const results = await Promise.allSettled(fetchers.map(f => f()));
          for (const res of results) {
            if (res.status === 'fulfilled' && res.value?.results) {
              for (const item of res.value.results) {
                if (!candidates.some(c => c.type === 'movie' && c.item.id === item.id)) {
                  candidates.push({ item, type: 'movie' });
                }
              }
            }
          }
        } else {
          for (let p = 1; p <= pagesNeeded; p++) {
            if (cancellationToken?.isCancelled) break;
            let obs;
            switch (category) {
              case 'trending': obs = this.movieService.getTrendingMovies('week', p); break;
              case 'popular': obs = this.movieService.getPopularMovies(p); break;
              case 'top_rated': obs = this.movieService.getTopRatedMovies(p); break;
              case 'now_playing': obs = this.movieService.getNowPlayingMovies(p); break;
              case 'upcoming': obs = this.movieService.getUpcomingMovies(p); break;
              default: obs = this.movieService.getPopularMovies(p);
            }
            try {
              const res = await firstValueFrom(obs);
              if (res?.results) {
                for (const item of res.results) {
                  if (!candidates.some(c => c.type === 'movie' && c.item.id === item.id)) {
                    candidates.push({ item, type: 'movie' });
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching movie page ${p}:`, err);
            }
          }
        }
      };

      // Helper to fetch TV shows
      const fetchTv = async (category: string, count: number) => {
        const pagesNeeded = Math.ceil(count / 20);
        if (category === 'all') {
          const fetchers = [
            () => firstValueFrom(this.movieService.getTrendingTv('week', 1)),
            () => firstValueFrom(this.movieService.getPopularTv(1)),
            () => firstValueFrom(this.movieService.getTopRatedTv(1)),
            () => firstValueFrom(this.movieService.getOnAirTv(1)),
            () => firstValueFrom(this.movieService.getAiringTodayTv(1))
          ];
          const results = await Promise.allSettled(fetchers.map(f => f()));
          for (const res of results) {
            if (res.status === 'fulfilled' && res.value?.results) {
              for (const item of res.value.results) {
                if (!candidates.some(c => c.type === 'tv' && c.item.id === item.id)) {
                  candidates.push({ item, type: 'tv' });
                }
              }
            }
          }
        } else {
          for (let p = 1; p <= pagesNeeded; p++) {
            if (cancellationToken?.isCancelled) break;
            let obs;
            switch (category) {
              case 'trending': obs = this.movieService.getTrendingTv('week', p); break;
              case 'popular': obs = this.movieService.getPopularTv(p); break;
              case 'top_rated': obs = this.movieService.getTopRatedTv(p); break;
              case 'now_playing':
              case 'on_air': obs = this.movieService.getOnAirTv(p); break;
              case 'upcoming':
              case 'airing_today': obs = this.movieService.getAiringTodayTv(p); break;
              default: obs = this.movieService.getPopularTv(p);
            }
            try {
              const res = await firstValueFrom(obs);
              if (res?.results) {
                for (const item of res.results) {
                  if (!candidates.some(c => c.type === 'tv' && c.item.id === item.id)) {
                    candidates.push({ item, type: 'tv' });
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching tv page ${p}:`, err);
            }
          }
        }
      };

      if (targetMediaType === 'movie') {
        await fetchMovies(options.category, options.limit);
      } else if (targetMediaType === 'tv') {
        await fetchTv(options.category, options.limit);
      } else {
        // 'all' = half movies, half tv
        const half = Math.ceil(options.limit / 2);
        await Promise.all([fetchMovies(options.category, half), fetchTv(options.category, half)]);
      }

      const targets = candidates.slice(0, options.limit);
      progress.total = targets.length;
      progress.message = `Found ${targets.length} items. Starting import process...`;
      emit();

      // 3. Process each item
      for (let i = 0; i < targets.length; i++) {
        if (cancellationToken?.isCancelled) {
          progress.status = 'cancelled';
          progress.message = `Import stopped by user. Processed ${progress.current}/${progress.total} items.`;
          emit();
          return progress;
        }

        const { item, type } = targets[i];
        progress.current = i + 1;
        const displayTitle = item.title || item.name || `${type === 'tv' ? 'Series' : 'Movie'} #${item.id}`;
        progress.title = displayTitle;
        progress.posterPath = item.poster_path;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const existingSet = type === 'tv' ? tvIds : movieIds;

        // Skip existing check
        if (options.skipExisting !== false && existingSet.has(item.id.toString())) {
          progress.skippedCount++;
          progress.message = `Skipped "${displayTitle}" (already in ${type} catalog)`;
          progress.logs.unshift({
            title: `[${type.toUpperCase()}] ${displayTitle}`,
            status: 'skipped',
            time: timeStr
          });
          emit();
          continue;
        }

        // Import
        try {
          progress.message = `Importing ${type === 'tv' ? 'Series' : 'Movie'} "${displayTitle}"...`;
          emit();

          await this.importFromTmdb(item.id, type, {
            featured: options.markFeatured,
            trending: options.markTrending,
            published: options.autoPublish ?? true
          });

          existingSet.add(item.id.toString());
          progress.successCount++;
          progress.logs.unshift({
            title: `[${type.toUpperCase()}] ${displayTitle}`,
            status: 'success',
            time: timeStr
          });
          emit();
        } catch (err: any) {
          progress.failedCount++;
          progress.message = `Failed "${displayTitle}": ${err.message || 'Error'}`;
          progress.logs.unshift({
            title: `[${type.toUpperCase()}] ${displayTitle}`,
            status: 'error',
            time: timeStr
          });
          emit();
        }

        // Polite delay for TMDB rate limits
        await new Promise(r => setTimeout(r, 60));
      }

      progress.status = 'completed';
      progress.message = `Auto-import completed! ${progress.successCount} imported, ${progress.skippedCount} skipped, ${progress.failedCount} failed.`;
      emit();

      await this.logAction(`auto_import_${targetMediaType}`, options.category, `Imported: ${progress.successCount}, Skipped: ${progress.skippedCount}, Failed: ${progress.failedCount}`);
      await this.updateLastSyncStats(progress.successCount, targetMediaType);

      return progress;
    } catch (err: any) {
      progress.status = 'error';
      progress.message = `Import failed: ${err.message || 'Unknown error'}`;
      emit();
      return progress;
    }
  }

  async autoImportMovies(
    options: AutoImportOptions,
    onProgress?: (progress: AutoImportProgress) => void,
    cancellationToken?: { isCancelled: boolean }
  ): Promise<AutoImportProgress> {
    return this.autoImportMedia({ ...options, mediaType: 'movie' }, onProgress, cancellationToken);
  }

  async autoImportTv(
    options: AutoImportOptions,
    onProgress?: (progress: AutoImportProgress) => void,
    cancellationToken?: { isCancelled: boolean }
  ): Promise<AutoImportProgress> {
    return this.autoImportMedia({ ...options, mediaType: 'tv' }, onProgress, cancellationToken);
  }

  // ─── Auto Sync Settings ──────────────────────────────────────────

  async getAutoSyncConfig(mediaType: 'movie' | 'tv' = 'movie'): Promise<AutoSyncConfig> {
    const key = mediaType === 'tv' ? 'auto_sync_tv' : 'auto_sync_movies';
    const snap = await get(ref(this.db, key));
    return this.zone.run(() => {
      if (!snap.exists()) {
        return {
          enabled: false,
          category: 'trending',
          limit: 20
        };
      }
      return snap.val();
    });
  }

  async saveAutoSyncConfig(config: AutoSyncConfig, mediaType: 'movie' | 'tv' = 'movie'): Promise<void> {
    const key = mediaType === 'tv' ? 'auto_sync_tv' : 'auto_sync_movies';
    await set(ref(this.db, key), config);
    await this.logAction(`save_auto_sync_${mediaType}`, config.category, `enabled=${config.enabled}, limit=${config.limit}`);
  }

  private async updateLastSyncStats(count: number, mediaType: string = 'movie'): Promise<void> {
    try {
      const key = mediaType === 'tv' ? 'auto_sync_tv' : 'auto_sync_movies';
      const snap = await get(ref(this.db, key));
      if (snap.exists()) {
        await update(ref(this.db, key), {
          lastSyncTimestamp: Date.now(),
          lastSyncCount: count
        });
      }
    } catch { /* ok */ }
  }

  // ─── Streaming Servers ───────────────────────────────────────────

  async getServers(): Promise<StreamServerConfig[]> {
    const snap = await get(ref(this.db, 'stream_servers'));
    const defaults = this.getDefaultServers();
    const defaultsMap = new Map(defaults.map(d => [d.id, d]));
    return this.zone.run(() => {
      if (!snap.exists()) return defaults;
      const raw = Object.values(snap.val() as Record<string, StreamServerConfig>);
      return raw
        .map(s => {
          const def = defaultsMap.get(s.id);
          return {
            ...s,
            urlTemplate: s.urlTemplate || def?.urlTemplate || 'https://vidsrc.me/embed/movie?tmdb={id}',
            tvUrlTemplate: s.tvUrlTemplate || def?.tvUrlTemplate || 'https://vidsrc.me/embed/tv?tmdb={id}&season={s}&episode={e}',
            active: s.active ?? s.enabled ?? true,
            enabled: s.enabled ?? s.active ?? true
          };
        })
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });
  }

  async saveServer(server: StreamServerConfig): Promise<void> {
    const isAct = server.active ?? server.enabled ?? true;
    const payload: StreamServerConfig = {
      ...server,
      urlTemplate: server.urlTemplate || 'https://vidsrc.me/embed/movie?tmdb={id}',
      tvUrlTemplate: server.tvUrlTemplate || 'https://vidsrc.me/embed/tv?tmdb={id}&season={s}&episode={e}',
      active: isAct,
      enabled: isAct
    };
    await set(ref(this.db, `stream_servers/${server.id}`), payload);
    await this.logAction('save_server', server.id, server.name);
  }

  async deleteServer(id: string): Promise<void> {
    await remove(ref(this.db, `stream_servers/${id}`));
    await this.logAction('delete_server', id);
  }

  async toggleServer(id: string, enabled: boolean): Promise<void> {
    await update(ref(this.db, `stream_servers/${id}`), { enabled, active: enabled });
  }

  private getDefaultServers(): StreamServerConfig[] {
    return [
      {
        id: 'vidsrc-me',
        name: 'VidSrc Prime (Server 1 - Default)',
        urlTemplate: 'https://vidsrc.me/embed/movie?tmdb={id}',
        tvUrlTemplate: 'https://vidsrc.me/embed/tv?tmdb={id}&season={s}&episode={e}',
        priority: 1,
        enabled: true,
        active: true,
        isDefault: true
      },
      {
        id: 'vidsrc-cc',
        name: 'VidSrc CC (Server 2)',
        urlTemplate: 'https://vidsrc.cc/v2/embed/movie/{id}',
        tvUrlTemplate: 'https://vidsrc.cc/v2/embed/tv/{id}/{s}/{e}',
        priority: 2,
        enabled: true,
        active: true
      },
      {
        id: 'multiembed',
        name: 'MultiEmbed (Server 3)',
        urlTemplate: 'https://multiembed.mov/?video_id={id}&tmdb=1',
        tvUrlTemplate: 'https://multiembed.mov/?video_id={id}&tmdb=1&s={s}&e={e}',
        priority: 3,
        enabled: true,
        active: true
      },
      {
        id: 'autoembed',
        name: 'AutoEmbed Fast (Server 4)',
        urlTemplate: 'https://player.autoembed.cc/embed/movie/{id}',
        tvUrlTemplate: 'https://player.autoembed.cc/embed/tv/{id}/{s}/{e}',
        priority: 4,
        enabled: true,
        active: true,
        isBackup: true
      }
    ];
  }

  // ─── Genres / Collections ────────────────────────────────────────

  async getCustomGenres(): Promise<any[]> {
    const snap = await get(ref(this.db, 'custom_genres'));
    return this.zone.run(() => {
      if (!snap.exists()) return [];
      return Object.values(snap.val());
    });
  }

  async saveCustomGenre(genre: any): Promise<void> {
    const id = genre.id || push(ref(this.db, 'custom_genres')).key;
    await set(ref(this.db, `custom_genres/${id}`), { ...genre, id });
  }

  async deleteCustomGenre(id: string): Promise<void> {
    await remove(ref(this.db, `custom_genres/${id}`));
  }

  // ─── Homepage CMS ────────────────────────────────────────────────

  async getHomepageConfig(): Promise<any> {
    const snap = await get(ref(this.db, 'homepage_config'));
    return this.zone.run(() => {
      return snap.exists() ? snap.val() : this.getDefaultHomepageConfig();
    });
  }

  async saveHomepageConfig(config: any): Promise<void> {
    await set(ref(this.db, 'homepage_config'), config);
    await this.logAction('save_homepage_config', 'homepage');
  }

  private getDefaultHomepageConfig() {
    return {
      heroEnabled: true,
      sections: [
        { id: 'trending_movies', title: 'Trending Movies', enabled: true, order: 1 },
        { id: 'trending_tv', title: 'Trending TV', enabled: true, order: 2 },
        { id: 'popular_movies', title: 'Popular Movies', enabled: true, order: 3 },
        { id: 'top_rated', title: 'Top Rated', enabled: true, order: 4 },
        { id: 'now_playing', title: 'Now Playing', enabled: true, order: 5 },
        { id: 'upcoming', title: 'Upcoming', enabled: true, order: 6 }
      ]
    };
  }

  // ─── Admin Logs ──────────────────────────────────────────────────

  async logAction(action: string, target?: string, details?: string): Promise<void> {
    try {
      const user = await firstValueFrom(this.auth.currentUser$);
      if (!user) return;

      let geo: any = null;
      try {
        const stored = sessionStorage.getItem('netmirrorbd_cached_geo_v2');
        if (stored) geo = JSON.parse(stored);
      } catch { /* ignore */ }

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const dev = /Mobi|Android|iPhone/i.test(ua) ? 'Mobile' : /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Desktop';
      const os = /Win/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : 'Linux';

      const log: AdminLog = {
        adminId: user.uid,
        adminEmail: user.email || '',
        action,
        target,
        details,
        timestamp: Date.now(),
        level: 'info',
        ip: geo?.ip || undefined,
        location: geo?.city ? `${geo.city}, ${geo.country}` : geo?.country || undefined,
        isp: geo?.isp || geo?.org || undefined,
        device: `${dev} (${os})`
      };
      await push(ref(this.db, 'admin_logs'), log);
    } catch { /* silent */ }
  }

  async getLogs(limit = 100): Promise<AdminLog[]> {
    const snap = await get(ref(this.db, 'admin_logs'));
    return this.zone.run(() => {
      if (!snap.exists()) return [];
      return Object.entries(snap.val() as Record<string, AdminLog>)
        .map(([id, log]) => ({ ...log, id }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    });
  }

  // ─── Utils ───────────────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}

import { Injectable, inject, NgZone } from '@angular/core';
import { getDatabase, ref, set, get, push, update, remove, onValue } from 'firebase/database';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { AdCooldownService } from './ad-cooldown.service';
import { SiteSettings, DEFAULT_SITE_SETTINGS, AdConfig } from '../models/media.model';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';

/**
 * Utility to deeply sanitize an object so it has no `undefined` properties,
 * which Firebase Realtime Database set() rejects.
 */
function sanitizeForFirebase(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirebase);

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = sanitizeForFirebase(val);
    }
  }
  return clean;
}

export const DEFAULT_ADS: AdConfig[] = [
  {
    id: 'ad-player-top',
    name: 'Player Top Banner (728x90)',
    position: 'player_top',
    htmlCode: '<div style="background:linear-gradient(135deg,#1e1b4b,#312e81);color:#a5b4fc;padding:12px 20px;border-radius:8px;text-align:center;font-weight:700;font-size:0.9rem;border:1px solid rgba(165,180,252,0.2);">🎬 Stream in Ultra 4K with Net Mirror BD VIP • Ad-Free Premium Experience</div>',
    active: true
  },
  {
    id: 'ad-player-bottom',
    name: 'Player Bottom Banner (728x90)',
    position: 'player_bottom',
    htmlCode: '<div style="background:linear-gradient(135deg,#064e3b,#065f46);color:#6ee7b7;padding:14px 20px;border-radius:8px;text-align:center;font-weight:700;font-size:0.9rem;border:1px solid rgba(110,231,183,0.2);">🚀 High Speed Streaming Partner • Shield Your IP & Watch Instantly</div>',
    active: true
  },
  {
    id: 'ad-home-interstitial',
    name: 'Homepage Sponsor Banner',
    position: 'home_interstitial',
    htmlCode: '<div style="background:linear-gradient(90deg,#18181b,#27272a);color:#e4e4e7;padding:16px 24px;border-radius:12px;text-align:center;border:1px solid #3f3f46;font-size:0.95rem;">⚡ <strong>Official Streaming Sponsor</strong>: Over 10,000+ Movies & TV Series in Full HD • Unlimited Streaming</div>',
    active: true
  }
];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly firebase = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly adCooldown = inject(AdCooldownService);
  private readonly ngZone = inject(NgZone);
  private readonly db = this.firebase.db;

  private readonly _settings$ = new BehaviorSubject<SiteSettings>(this.loadCachedSettings());
  readonly settings$: Observable<SiteSettings> = this._settings$.asObservable();

  private readonly _ads$ = new BehaviorSubject<AdConfig[]>(this.loadCachedAds());
  readonly ads$: Observable<AdConfig[]> = this._ads$.asObservable();

  constructor() {
    this.initRealtimeSync();
  }

  get settings(): SiteSettings {
    return this._settings$.value;
  }

  get ads(): AdConfig[] {
    return this._ads$.value;
  }

  // ─── Realtime Database Listeners ─────────────────────────────────

  private initRealtimeSync(): void {
    // 1. Site Settings Realtime Sync
    const settingsRef = ref(this.db, 'site_settings');
    onValue(settingsRef, snapshot => {
      this.ngZone.run(() => {
        if (snapshot.exists()) {
          const remote = snapshot.val();
          const merged: SiteSettings = {
            ...DEFAULT_SITE_SETTINGS,
            ...remote,
            announcement: remote.announcement
              ? { ...DEFAULT_SITE_SETTINGS.announcement, ...remote.announcement }
              : { enabled: false, message: '', type: 'info' }
          };
          this._settings$.next(merged);
          this.cacheSettings(merged);
        } else {
          this._settings$.next(DEFAULT_SITE_SETTINGS);
          this.cacheSettings(DEFAULT_SITE_SETTINGS);
        }
      });
    }, error => {
      console.warn('Firebase site_settings listener warning:', error);
    });

    // 2. Advertisements Realtime Sync
    const adsRef = ref(this.db, 'advertisements');
    onValue(adsRef, snapshot => {
      this.ngZone.run(() => {
        if (snapshot.exists()) {
          const raw = snapshot.val() as Record<string, any>;
          const list: AdConfig[] = Object.values(raw).map(ad => ({
            id: ad.id || `ad-${Date.now()}`,
            name: ad.name || 'Ad Banner',
            position: ad.position || ad.placement || 'player_bottom',
            htmlCode: ad.htmlCode || ad.code || '',
            active: ad.active ?? ad.enabled ?? true
          }));
          this._ads$.next(list);
          this.cacheAds(list);
        } else {
          this._ads$.next([]);
          this.cacheAds([]);
        }
      });
    }, error => {
      console.warn('Firebase advertisements listener warning:', error);
    });
  }

  // ─── Site Settings CRUD ──────────────────────────────────────────

  async getSettings(): Promise<SiteSettings> {
    try {
      const snap = await get(ref(this.db, 'site_settings'));
      if (snap.exists()) {
        const remote = snap.val();
        const merged: SiteSettings = {
          ...DEFAULT_SITE_SETTINGS,
          ...remote,
          announcement: remote.announcement
            ? { ...DEFAULT_SITE_SETTINGS.announcement, ...remote.announcement }
            : { enabled: false, message: '', type: 'info' }
        };
        this._settings$.next(merged);
        this.cacheSettings(merged);
        return merged;
      }
    } catch (e) {
      console.warn('Failed to fetch remote site_settings, using cached:', e);
    }
    return this._settings$.value;
  }

  async saveSettings(partial: Partial<SiteSettings>): Promise<void> {
    const current = this._settings$.value;
    const merged: SiteSettings = {
      ...current,
      ...partial,
      announcement: partial.announcement
        ? { ...(current.announcement || { enabled: false, message: '', type: 'info' }), ...partial.announcement }
        : current.announcement,
      seo: partial.seo
        ? { ...(current.seo || {}), ...partial.seo }
        : current.seo
    };

    // Sanitize before saving to RTDB
    const sanitized = sanitizeForFirebase(merged);

    // Update local BehaviorSubject & LocalStorage immediately for instant UX
    this.ngZone.run(() => {
      this._settings$.next(merged);
      this.cacheSettings(merged);
    });

    // Save to Firebase RTDB
    await set(ref(this.db, 'site_settings'), sanitized);
  }

  async updateField(field: keyof SiteSettings, value: any): Promise<void> {
    const sanitizedVal = sanitizeForFirebase(value);
    await update(ref(this.db, 'site_settings'), { [field]: sanitizedVal });
    const next = { ...this._settings$.value, [field]: value };
    this._settings$.next(next);
    this.cacheSettings(next);
  }

  // ─── Advertisements CRUD ─────────────────────────────────────────

  async getAds(): Promise<AdConfig[]> {
    try {
      const snap = await get(ref(this.db, 'advertisements'));
      if (snap.exists()) {
        const raw = snap.val() as Record<string, any>;
        const list: AdConfig[] = Object.values(raw).map(ad => ({
          id: ad.id || `ad-${Date.now()}`,
          name: ad.name || 'Ad Banner',
          position: ad.position || ad.placement || 'player_bottom',
          htmlCode: ad.htmlCode || ad.code || '',
          active: ad.active ?? ad.enabled ?? true
        }));
        this._ads$.next(list);
        this.cacheAds(list);
        return list;
      }
    } catch (e) {
      console.warn('Failed to fetch remote advertisements, using cached:', e);
    }
    return this._ads$.value;
  }

  async saveAd(ad: AdConfig): Promise<AdConfig> {
    const id = ad.id || push(ref(this.db, 'advertisements')).key || `ad-${Date.now()}`;
    const full: AdConfig = {
      ...ad,
      id,
      active: ad.active ?? true,
      htmlCode: ad.htmlCode || ''
    };

    const sanitized = sanitizeForFirebase({
      ...full,
      enabled: full.active,
      placement: full.position,
      code: full.htmlCode,
      createdAt: Date.now()
    });

    // Update locally
    const current = this._ads$.value;
    const exists = current.some(a => a.id === id);
    const next = exists ? current.map(a => (a.id === id ? full : a)) : [...current, full];
    this._ads$.next(next);
    this.cacheAds(next);

    // Save to Firebase RTDB
    await set(ref(this.db, `advertisements/${id}`), sanitized);
    return full;
  }

  async saveAllAds(ads: AdConfig[]): Promise<void> {
    const map: Record<string, any> = {};
    for (const ad of ads) {
      const id = ad.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      map[id] = sanitizeForFirebase({
        ...ad,
        id,
        enabled: ad.active,
        placement: ad.position,
        code: ad.htmlCode,
        createdAt: Date.now()
      });
    }

    this._ads$.next(ads);
    this.cacheAds(ads);

    await set(ref(this.db, 'advertisements'), map);
  }

  async deleteAd(id: string): Promise<void> {
    const next = this._ads$.value.filter(a => a.id !== id);
    this._ads$.next(next);
    this.cacheAds(next);

    await remove(ref(this.db, `advertisements/${id}`));
  }

  async toggleAd(id: string, active: boolean): Promise<void> {
    const current = this._ads$.value;
    const next = current.map(a => (a.id === id ? { ...a, active } : a));
    this._ads$.next(next);
    this.cacheAds(next);

    await update(ref(this.db, `advertisements/${id}`), {
      active,
      enabled: active
    });
  }

  async setAdsGloballyEnabled(enabled: boolean): Promise<void> {
    await this.updateField('adsEnabled', enabled);
  }

  isAdsGloballyEnabled(): boolean {
    return this.settings.adsEnabled !== false;
  }

  getAdsByPosition(position: string): Observable<AdConfig[]> {
    return combineLatest([this.ads$, this.settings$, this.adCooldown.cooldownActive$]).pipe(
      map(([ads, settings, isCooldown]) => {
        // Global kill-switch: if adsEnabled is explicitly false, return nothing
        if (settings.adsEnabled === false) return [];
        // Device 24-hour cooldown: if user has active cooldown, return nothing
        if (isCooldown) return [];
        return ads.filter(a => a.active && a.position === position && !!a.htmlCode.trim());
      })
    );
  }

  // ─── LocalStorage Cache Helpers ──────────────────────────────────

  private cacheSettings(settings: SiteSettings): void {
    try {
      localStorage.setItem('netmirrorbd_site_settings', JSON.stringify(settings));
    } catch { /* storage quota or restricted */ }
  }

  private loadCachedSettings(): SiteSettings {
    try {
      const stored = localStorage.getItem('netmirrorbd_site_settings');
      if (stored) {
        return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(stored) };
      }
    } catch { /* ignore */ }
    return DEFAULT_SITE_SETTINGS;
  }

  private cacheAds(ads: AdConfig[]): void {
    try {
      localStorage.setItem('netmirrorbd_ads', JSON.stringify(ads));
    } catch { /* ignore */ }
  }

  private loadCachedAds(): AdConfig[] {
    try {
      const stored = localStorage.getItem('netmirrorbd_ads');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_ADS;
  }
}

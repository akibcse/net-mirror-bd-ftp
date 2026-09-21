import { Injectable, inject } from '@angular/core';
import { ref, set, remove, get, onValue, off, push, Unsubscribe } from 'firebase/database';
import { BehaviorSubject, Observable, firstValueFrom, filter, timeout } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { WatchlistItem, WatchHistoryItem, UserReview, MediaType } from '../models/media.model';

/**
 * Sanitize object to remove `undefined` properties, which Firebase Realtime Database set() rejects.
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

/**
 * Standardize watchlist/favorite items so both movie and TV properties are always populated
 * and never undefined.
 */
function normalizeWatchlistItem(item: any): WatchlistItem {
  const id = Number(item.id);
  const mediaType: MediaType = (item.mediaType || item.media_type || (item.name && !item.title ? 'tv' : 'movie')) as MediaType;
  const title = item.title || item.name || 'Untitled';
  const releaseDate = item.release_date || item.first_air_date || '';

  return {
    id,
    mediaType,
    media_type: mediaType,
    title,
    name: title,
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    vote_average: Number(item.vote_average) || 0,
    release_date: releaseDate,
    first_air_date: releaseDate,
    addedAt: item.addedAt || Date.now()
  };
}

function normalizeHistoryItem(item: any): WatchHistoryItem {
  const base = normalizeWatchlistItem(item);
  return {
    ...base,
    season: item.season ? Number(item.season) : undefined,
    episode: item.episode ? Number(item.episode) : undefined,
    watchedAt: item.watchedAt || Date.now(),
    progressSeconds: item.progressSeconds ? Number(item.progressSeconds) : undefined,
    durationSeconds: item.durationSeconds ? Number(item.durationSeconds) : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserActivityService {
  private readonly firebase = inject(FirebaseService);
  private readonly auth = inject(AuthService);

  private readonly watchlistSubject = new BehaviorSubject<WatchlistItem[]>([]);
  readonly watchlist$ = this.watchlistSubject.asObservable();

  private readonly favoritesSubject = new BehaviorSubject<WatchlistItem[]>([]);
  readonly favorites$ = this.favoritesSubject.asObservable();

  private readonly historySubject = new BehaviorSubject<WatchHistoryItem[]>([]);
  readonly history$ = this.historySubject.asObservable();

  private activeUid: string | null = null;
  private unsubs: Unsubscribe[] = [];

  constructor() {
    // React to auth changes: automatically bind database listeners to the logged-in account
    this.auth.currentUser$.subscribe(user => {
      const newUid = user?.uid || this.firebase.auth.currentUser?.uid || null;
      if (newUid !== this.activeUid) {
        this.activeUid = newUid;
        if (newUid) {
          this.loadUserLists(newUid);
        } else {
          this.clearLists();
        }
      }
    });
  }

  get currentUid(): string | null {
    return this.auth.currentUser?.uid || this.firebase.auth.currentUser?.uid || null;
  }

  private cleanupListeners(): void {
    for (const unsub of this.unsubs) {
      try { unsub(); } catch { /* ok */ }
    }
    this.unsubs = [];
  }

  private clearLists(): void {
    this.cleanupListeners();
    this.watchlistSubject.next([]);
    this.favoritesSubject.next([]);
    this.historySubject.next([]);
  }

  /**
   * Load account-specific lists from Firebase Realtime Database
   */
  private loadUserLists(uid: string): void {
    this.cleanupListeners();

    // 1. Instantly display this specific account's cached lists
    const cachedWl = this.getLocalList(`netmirrorbd_${uid}_watchlist`);
    const cachedFav = this.getLocalList(`netmirrorbd_${uid}_favorites`);
    const cachedHist = this.getLocalList(`netmirrorbd_${uid}_history`);

    this.watchlistSubject.next(cachedWl);
    this.favoritesSubject.next(cachedFav);
    this.historySubject.next(cachedHist);

    const db = this.firebase.db;

    // 2. Realtime listener: Watchlist
    const wlRef = ref(db, `user_activity/${uid}/watchlist`);
    const unsubWl = onValue(wlRef, snap => {
      const data = snap.val() || {};
      const remoteList: WatchlistItem[] = Object.values(data).map(normalizeWatchlistItem);
      remoteList.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      this.watchlistSubject.next(remoteList);
      this.saveLocalList(`netmirrorbd_${uid}_watchlist`, remoteList);
    }, error => {
      console.warn('Watchlist listener error:', error);
    });
    this.unsubs.push(unsubWl);

    // 3. Realtime listener: Favorites
    const favRef = ref(db, `user_activity/${uid}/favorites`);
    const unsubFav = onValue(favRef, snap => {
      const data = snap.val() || {};
      const remoteList: WatchlistItem[] = Object.values(data).map(normalizeWatchlistItem);
      remoteList.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      this.favoritesSubject.next(remoteList);
      this.saveLocalList(`netmirrorbd_${uid}_favorites`, remoteList);
    }, error => {
      console.warn('Favorites listener error:', error);
    });
    this.unsubs.push(unsubFav);

    // 4. Realtime listener: Continue Watching (History)
    const histRef = ref(db, `user_activity/${uid}/history`);
    const unsubHist = onValue(histRef, snap => {
      const data = snap.val() || {};
      const remoteList: WatchHistoryItem[] = Object.values(data).map(normalizeHistoryItem);
      remoteList.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
      this.historySubject.next(remoteList);
      this.saveLocalList(`netmirrorbd_${uid}_history`, remoteList);
    }, error => {
      console.warn('History listener error:', error);
    });
    this.unsubs.push(unsubHist);
  }

  private getLocalList(key: string): any[] {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return key.includes('history') ? parsed.map(normalizeHistoryItem) : parsed.map(normalizeWatchlistItem);
        }
      }
    } catch { /* ignore */ }
    return [];
  }

  private saveLocalList(key: string, list: any[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch { /* quota / restriction */ }
  }

  private async resolveUid(): Promise<string | null> {
    let uid = this.currentUid;
    if (!uid) {
      try {
        const authUser = await firstValueFrom(
          this.auth.currentUser$.pipe(
            filter(u => u !== null),
            timeout(2000)
          )
        );
        if (authUser) uid = authUser.uid;
      } catch {
        // guest or timeout
      }
    }
    return uid;
  }

  // ─── WATCHLIST ───────────────────────────────────────────────────

  isInWatchlist(id: number | string): boolean {
    const numId = Number(id);
    if (!numId) return false;
    return this.watchlistSubject.value.some(item => Number(item.id) === numId);
  }

  async toggleWatchlist(item: Partial<WatchlistItem> & { id: number | string }): Promise<boolean> {
    const clean = normalizeWatchlistItem(item);
    const exists = this.isInWatchlist(clean.id);
    const uid = await this.resolveUid();

    // 1. Instant Optimistic Local Update
    let nextList: WatchlistItem[];
    let willExist = false;

    if (exists) {
      nextList = this.watchlistSubject.value.filter(i => Number(i.id) !== clean.id);
      willExist = false;
    } else {
      nextList = [clean, ...this.watchlistSubject.value.filter(i => Number(i.id) !== clean.id)];
      willExist = true;
    }

    this.watchlistSubject.next(nextList);

    // 2. Account-specific Database Sync
    if (uid) {
      this.saveLocalList(`netmirrorbd_${uid}_watchlist`, nextList);
      const wlNode = ref(this.firebase.db, `user_activity/${uid}/watchlist/${clean.id}`);
      try {
        if (exists) {
          await remove(wlNode);
        } else {
          await set(wlNode, sanitizeForFirebase(clean));
        }
      } catch (err) {
        console.warn('Firebase watchlist sync warning:', err);
      }
    }

    return willExist;
  }

  // ─── FAVORITES ───────────────────────────────────────────────────

  isInFavorites(id: number | string): boolean {
    const numId = Number(id);
    if (!numId) return false;
    return this.favoritesSubject.value.some(item => Number(item.id) === numId);
  }

  async toggleFavorite(item: Partial<WatchlistItem> & { id: number | string }): Promise<boolean> {
    const clean = normalizeWatchlistItem(item);
    const exists = this.isInFavorites(clean.id);
    const uid = await this.resolveUid();

    // 1. Instant Optimistic Local Update
    let nextList: WatchlistItem[];
    let willExist = false;

    if (exists) {
      nextList = this.favoritesSubject.value.filter(i => Number(i.id) !== clean.id);
      willExist = false;
    } else {
      nextList = [clean, ...this.favoritesSubject.value.filter(i => Number(i.id) !== clean.id)];
      willExist = true;
    }

    this.favoritesSubject.next(nextList);

    // 2. Account-specific Database Sync
    if (uid) {
      this.saveLocalList(`netmirrorbd_${uid}_favorites`, nextList);
      const favNode = ref(this.firebase.db, `user_activity/${uid}/favorites/${clean.id}`);
      try {
        if (exists) {
          await remove(favNode);
        } else {
          await set(favNode, sanitizeForFirebase(clean));
        }
      } catch (err) {
        console.warn('Firebase favorites sync warning:', err);
      }
    }

    return willExist;
  }

  // ─── WATCH HISTORY / CONTINUE WATCHING ───────────────────────────

  async recordWatch(item: Partial<WatchHistoryItem> & { id: number | string }): Promise<void> {
    const clean = normalizeHistoryItem(item);
    const uid = await this.resolveUid();

    // Optimistic local state update
    const current = this.historySubject.value.filter(i => Number(i.id) !== clean.id);
    const nextList = [clean, ...current].slice(0, 40);
    this.historySubject.next(nextList);

    // Account-specific Database Sync
    if (uid) {
      this.saveLocalList(`netmirrorbd_${uid}_history`, nextList);
      const histNode = ref(this.firebase.db, `user_activity/${uid}/history/${clean.id}`);
      try {
        await set(histNode, sanitizeForFirebase(clean));
      } catch (err) {
        console.warn('Firebase history record warning:', err);
      }
    }
  }

  async removeFromHistory(id: number | string): Promise<void> {
    const numId = Number(id);
    const uid = this.currentUid;
    const nextList = this.historySubject.value.filter(i => Number(i.id) !== numId);
    this.historySubject.next(nextList);

    if (uid) {
      this.saveLocalList(`netmirrorbd_${uid}_history`, nextList);
      const histNode = ref(this.firebase.db, `user_activity/${uid}/history/${numId}`);
      try {
        await remove(histNode);
      } catch (err) {
        console.warn('Firebase history remove warning:', err);
      }
    }
  }

  // ─── REVIEWS & RATINGS ───────────────────────────────────────────

  getReviews(mediaId: number): Observable<UserReview[]> {
    return new Observable<UserReview[]>(observer => {
      const reviewsRef = ref(this.firebase.db, `media_reviews/${mediaId}`);
      const listener = onValue(
        reviewsRef,
        snap => {
          if (snap.exists()) {
            const data = snap.val();
            const list: UserReview[] = Object.entries(data).map(([id, val]) => ({
              ...(val as UserReview),
              id
            }));
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            observer.next(list);
          } else {
            observer.next([]);
          }
        },
        err => observer.error(err)
      );

      return () => off(reviewsRef, 'value', listener);
    });
  }

  async addReview(
    mediaId: number,
    mediaType: MediaType,
    rating: number,
    content: string
  ): Promise<void> {
    const user = this.auth.currentUser;
    const review: UserReview = {
      mediaId,
      mediaType,
      userId: user?.uid || 'guest',
      userName: user?.displayName || user?.email?.split('@')[0] || 'Anonymous Viewer',
      userEmail: user?.email || 'anonymous',
      rating,
      content,
      createdAt: Date.now()
    };

    const reviewsRef = ref(this.firebase.db, `media_reviews/${mediaId}`);
    await push(reviewsRef, sanitizeForFirebase(review));
  }

  // ─── REPORT BROKEN VIDEO ─────────────────────────────────────────

  async reportBrokenVideo(
    mediaId: number,
    title: string,
    server: string,
    reason: string,
    season?: number,
    episode?: number
  ): Promise<void> {
    const reportsRef = ref(this.firebase.db, 'broken_stream_reports');
    await push(reportsRef, sanitizeForFirebase({
      mediaId,
      title: title || 'Untitled',
      server: server || 'default',
      reason: reason || 'Broken video',
      season: season || null,
      episode: episode || null,
      reportedBy: this.auth.currentUser?.email || 'Anonymous',
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString()
    }));
  }
}

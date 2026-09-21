import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const COOLDOWN_KEY = 'netmirrorbd_ad_cooldown_until';
const LAST_VIEWED_KEY = 'netmirrorbd_ad_last_viewed_at';
const DEFAULT_COOLDOWN_HOURS = 24;

export interface CooldownInfo {
  active: boolean;
  remainingSeconds: number;
  remainingFormatted: string;
  cooldownUntil: number | null;
  lastViewedAt: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdCooldownService {
  private readonly _cooldownActive$ = new BehaviorSubject<boolean>(this.checkIsActive());
  readonly cooldownActive$: Observable<boolean> = this._cooldownActive$.asObservable();

  constructor() {
    // Check initial state
    this.refreshState();
  }

  /**
   * Returns whether the device is currently in the 24-hour ad cooldown window.
   */
  isCooldownActive(): boolean {
    return this.checkIsActive();
  }

  /**
   * Starts a 24-hour cooldown on this device after viewing an ad.
   */
  startCooldown(hours: number = DEFAULT_COOLDOWN_HOURS): void {
    try {
      const now = Date.now();
      const until = now + hours * 3600 * 1000;
      localStorage.setItem(COOLDOWN_KEY, until.toString());
      localStorage.setItem(LAST_VIEWED_KEY, now.toString());
      this._cooldownActive$.next(true);
    } catch {
      // Storage restricted or unavailable
    }
  }

  /**
   * Resets/clears the cooldown on this device (useful for admin testing).
   */
  resetCooldown(): void {
    try {
      localStorage.removeItem(COOLDOWN_KEY);
      localStorage.removeItem(LAST_VIEWED_KEY);
      this._cooldownActive$.next(false);
    } catch {
      // Storage restricted
    }
  }

  /**
   * Returns structured cooldown information including remaining hours/minutes.
   */
  getCooldownInfo(): CooldownInfo {
    try {
      const stored = localStorage.getItem(COOLDOWN_KEY);
      const lastViewedStored = localStorage.getItem(LAST_VIEWED_KEY);
      const lastViewedAt = lastViewedStored ? parseInt(lastViewedStored, 10) : null;

      if (!stored) {
        return {
          active: false,
          remainingSeconds: 0,
          remainingFormatted: '0h 0m',
          cooldownUntil: null,
          lastViewedAt
        };
      }

      const until = parseInt(stored, 10);
      const now = Date.now();
      const diffMs = until - now;

      if (isNaN(until) || diffMs <= 0) {
        return {
          active: false,
          remainingSeconds: 0,
          remainingFormatted: '0h 0m',
          cooldownUntil: null,
          lastViewedAt
        };
      }

      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);

      return {
        active: true,
        remainingSeconds: totalSec,
        remainingFormatted: `${hours}h ${mins}m`,
        cooldownUntil: until,
        lastViewedAt
      };
    } catch {
      return {
        active: false,
        remainingSeconds: 0,
        remainingFormatted: '0h 0m',
        cooldownUntil: null,
        lastViewedAt: null
      };
    }
  }

  refreshState(): void {
    const active = this.checkIsActive();
    if (this._cooldownActive$.value !== active) {
      this._cooldownActive$.next(active);
    }
  }

  private checkIsActive(): boolean {
    try {
      if (typeof window !== 'undefined') {
        const query = window.location.search;
        if (query.includes('test_ad') || query.includes('reset_ad')) {
          localStorage.removeItem(COOLDOWN_KEY);
          localStorage.removeItem(LAST_VIEWED_KEY);
          return false;
        }
      }
      const stored = localStorage.getItem(COOLDOWN_KEY);
      if (!stored) return false;
      const until = parseInt(stored, 10);
      if (isNaN(until)) return false;
      return Date.now() < until;
    } catch {
      return false;
    }
  }
}

import { Injectable, inject, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ref, push, onValue, off, remove } from 'firebase/database';
import { Observable, filter, catchError, of, firstValueFrom } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { VisitorLog, VisitorStats } from '../models/visitor-log.model';

export interface DetailedGeoData {
  ip: string;
  ipType?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  timezoneOffset?: string;
  isp?: string;
  org?: string;
  asn?: string | number;
  flag?: string;
}

export interface DetailedDeviceData {
  device: string;
  deviceModel: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenResolution: string;
  viewport: string;
  pixelRatio: number;
  colorDepth: number;
  orientation: string;
  cpuCores?: number;
  ram?: string;
  connectionType?: string;
  downlink?: string;
  rtt?: string;
  language: string;
  touchSupport: boolean;
  userAgent: string;
}

const GEO_STORAGE_KEY = 'netmirrorbd_cached_geo_v2';

@Injectable({
  providedIn: 'root'
})
export class VisitorLogService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly firebase = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  private cachedGeo: DetailedGeoData | null = null;
  private isTrackingStarted = false;
  private geoFetchPromise: Promise<DetailedGeoData> | null = null;

  constructor() {
    this.restoreCachedGeo();
  }

  startTracking(): void {
    if (this.isTrackingStarted) return;
    this.isTrackingStarted = true;

    // Prefetch client IP / geo info immediately
    this.getGeoInfo().catch(() => {});

    // Record initial visit immediately on app startup
    const initialPath = this.router.url || window.location.pathname || '/';
    this.recordVisit(initialPath).catch(() => {});

    // Listen to route changes
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => {
        this.recordVisit(event.urlAfterRedirects || event.url);
      });
  }

  private restoreCachedGeo(): void {
    try {
      const stored = sessionStorage.getItem(GEO_STORAGE_KEY);
      if (stored) {
        this.cachedGeo = JSON.parse(stored);
      }
    } catch {
      /* ignore storage issues */
    }
  }

  private saveCachedGeo(data: DetailedGeoData): void {
    this.cachedGeo = data;
    try {
      sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  /**
   * Fetches accurate IP geolocation, ISP, and network data using a multi-provider fallback strategy.
   */
  async getGeoInfo(): Promise<DetailedGeoData> {
    if (this.cachedGeo && this.cachedGeo.ip && this.cachedGeo.ip !== 'Detecting...') {
      return this.cachedGeo;
    }

    if (this.geoFetchPromise) {
      return this.geoFetchPromise;
    }

    this.geoFetchPromise = (async () => {
      // 0. Server-side lookup via /api/geo (Vercel) — resolves the REAL public IP
      //    from proxy headers, which is far more accurate than client-side APIs.
      try {
        const res = await firstValueFrom(
          this.http.get<any>('/api/geo').pipe(
            catchError(() => of(null))
          )
        );

        if (res && res.success !== false && res.ip && res.ip !== 'Unknown IP') {
          const geo: DetailedGeoData = {
            ip: res.ip,
            ipType: res.ipType || (res.ip.includes(':') ? 'IPv6' : 'IPv4'),
            city: res.city || '',
            region: res.region || '',
            country: res.country || 'Global',
            countryCode: res.countryCode || '',
            postal: res.postal || '',
            latitude: res.latitude,
            longitude: res.longitude,
            timezone: res.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: res.timezoneOffset || '',
            isp: res.isp || '',
            org: res.org || '',
            asn: res.asn || '',
            flag: res.flag || this.getFlagEmoji(res.countryCode)
          };
          this.saveCachedGeo(geo);
          return geo;
        }
      } catch {
        /* proceed to client-side fallbacks */
      }

      // 1. Try ipwho.is (CORS enabled, HTTPS, rich ISP & ASN data)
      try {
        const res = await firstValueFrom(
          this.http.get<any>('https://ipwho.is/').pipe(
            catchError(() => of(null))
          )
        );

        if (res && res.success !== false && res.ip) {
          const geo: DetailedGeoData = {
            ip: res.ip,
            ipType: res.type || (res.ip.includes(':') ? 'IPv6' : 'IPv4'),
            city: res.city || '',
            region: res.region || '',
            country: res.country || '',
            countryCode: res.country_code || '',
            postal: res.postal || '',
            latitude: res.latitude,
            longitude: res.longitude,
            timezone: res.timezone?.id || Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: res.timezone?.utc || '',
            isp: res.connection?.isp || res.connection?.org || '',
            org: res.connection?.org || '',
            asn: res.connection?.asn ? `AS${res.connection.asn}` : '',
            flag: res.flag?.emoji || this.getFlagEmoji(res.country_code)
          };
          this.saveCachedGeo(geo);
          return geo;
        }
      } catch {
        /* proceed to fallback */
      }

      // 2. Try freeipapi.com
      try {
        const res = await firstValueFrom(
          this.http.get<any>('https://freeipapi.com/api/json').pipe(
            catchError(() => of(null))
          )
        );

        if (res && res.ipAddress) {
          const geo: DetailedGeoData = {
            ip: res.ipAddress,
            ipType: res.ipVersion === 6 ? 'IPv6' : 'IPv4',
            city: res.cityName || '',
            region: res.regionName || '',
            country: res.countryName || '',
            countryCode: res.countryCode || '',
            postal: res.zipCode || '',
            latitude: res.latitude,
            longitude: res.longitude,
            timezone: res.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            flag: this.getFlagEmoji(res.countryCode)
          };
          this.saveCachedGeo(geo);
          return geo;
        }
      } catch {
        /* proceed to fallback */
      }

      // 3. Try ipapi.co
      try {
        const res = await firstValueFrom(
          this.http.get<any>('https://ipapi.co/json/').pipe(
            catchError(() => of(null))
          )
        );

        if (res && res.ip) {
          const geo: DetailedGeoData = {
            ip: res.ip,
            ipType: res.version || (res.ip.includes(':') ? 'IPv6' : 'IPv4'),
            city: res.city || '',
            region: res.region || '',
            country: res.country_name || '',
            countryCode: res.country_code || '',
            postal: res.postal || '',
            latitude: res.latitude,
            longitude: res.longitude,
            timezone: res.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: res.utc_offset || '',
            isp: res.org || '',
            org: res.org || '',
            asn: res.asn || '',
            flag: this.getFlagEmoji(res.country_code)
          };
          this.saveCachedGeo(geo);
          return geo;
        }
      } catch {
        /* proceed to fallback */
      }

      // 4. Basic fallback to ipify
      try {
        const res = await firstValueFrom(
          this.http.get<{ ip: string }>('https://api.ipify.org?format=json').pipe(
            catchError(() => of({ ip: 'Unknown IP' }))
          )
        );

        const geo: DetailedGeoData = {
          ip: res.ip || 'Unknown IP',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          country: 'Global'
        };
        this.saveCachedGeo(geo);
        return geo;
      } catch {
        const fallbackGeo: DetailedGeoData = {
          ip: 'Unknown IP',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          country: 'Global'
        };
        return fallbackGeo;
      } finally {
        this.geoFetchPromise = null;
      }
    })();

    return this.geoFetchPromise;
  }

  /**
   * Allows ad-hoc lookup of an arbitrary IP (e.g. from the admin console).
   */
  async lookupSpecificIp(ip: string): Promise<DetailedGeoData | null> {
    if (!ip || ip === 'Detecting...' || ip === 'Unknown IP') return null;
    try {
      const res = await firstValueFrom(
        this.http.get<any>(`https://ipwho.is/${encodeURIComponent(ip)}`).pipe(
          catchError(() => of(null))
        )
      );
      if (res && res.success !== false) {
        return {
          ip: res.ip,
          ipType: res.type || (res.ip.includes(':') ? 'IPv6' : 'IPv4'),
          city: res.city || '',
          region: res.region || '',
          country: res.country || '',
          countryCode: res.country_code || '',
          postal: res.postal || '',
          latitude: res.latitude,
          longitude: res.longitude,
          timezone: res.timezone?.id,
          timezoneOffset: res.timezone?.utc,
          isp: res.connection?.isp || res.connection?.org,
          org: res.connection?.org,
          asn: res.connection?.asn ? `AS${res.connection.asn}` : '',
          flag: res.flag?.emoji || this.getFlagEmoji(res.country_code)
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /**
   * Helper to convert country code into a flag emoji (e.g. 'US' -> 🇺🇸, 'BD' -> 🇧🇩)
   */
  getFlagEmoji(countryCode?: string): string {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Extracts thorough client device, hardware, display, and environment diagnostics.
   */
  getDeviceInfo(): DetailedDeviceData {
    const ua = navigator.userAgent;
    const { browser, browserVersion } = this.parseBrowser(ua);
    const { os, osVersion } = this.parseOs(ua);
    const { device, deviceModel } = this.parseDevice(ua, os);

    // Screen & Display
    const width = window.screen.width || window.innerWidth || 0;
    const height = window.screen.height || window.innerHeight || 0;
    const screenResolution = `${width}×${height}`;
    const viewport = `${window.innerWidth}×${window.innerHeight}`;
    const pixelRatio = window.devicePixelRatio || 1;
    const colorDepth = window.screen.colorDepth || 24;
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    // Hardware specs
    const cpuCores = navigator.hardwareConcurrency || undefined;
    const mem = (navigator as any).deviceMemory;
    const ram = mem ? `${mem} GB` : undefined;
    const touchSupport = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);

    // Network specs
    const conn = (navigator as any).connection;
    const connectionType = conn?.effectiveType ? conn.effectiveType.toUpperCase() : undefined;
    const downlink = conn?.downlink ? `${conn.downlink} Mbps` : undefined;
    const rtt = conn?.rtt ? `${conn.rtt} ms` : undefined;

    const language = navigator.language || 'en';

    return {
      device,
      deviceModel,
      browser,
      browserVersion,
      os,
      osVersion,
      screenResolution,
      viewport,
      pixelRatio,
      colorDepth,
      orientation,
      cpuCores,
      ram,
      connectionType,
      downlink,
      rtt,
      language,
      touchSupport,
      userAgent: ua
    };
  }

  private parseBrowser(ua: string): { browser: string; browserVersion: string } {
    let browser = 'Unknown Browser';
    let browserVersion = '';

    if (/Edg\/([\d.]+)/i.test(ua)) {
      browser = 'Microsoft Edge';
      browserVersion = RegExp.$1;
    } else if (/OPR\/([\d.]+)/i.test(ua) || /Opera\/([\d.]+)/i.test(ua)) {
      browser = 'Opera';
      browserVersion = RegExp.$1;
    } else if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
      browser = 'Samsung Internet';
      browserVersion = RegExp.$1;
    } else if (/Vivaldi\/([\d.]+)/i.test(ua)) {
      browser = 'Vivaldi';
      browserVersion = RegExp.$1;
    } else if (/UCBrowser\/([\d.]+)/i.test(ua)) {
      browser = 'UC Browser';
      browserVersion = RegExp.$1;
    } else if (/Chrome\/([\d.]+)/i.test(ua)) {
      browser = 'Google Chrome';
      browserVersion = RegExp.$1;
    } else if (/Firefox\/([\d.]+)/i.test(ua)) {
      browser = 'Mozilla Firefox';
      browserVersion = RegExp.$1;
    } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
      browser = 'Apple Safari';
      browserVersion = RegExp.$1;
    } else if (/MSIE ([\d.]+)|Trident.*rv:([\d.]+)/i.test(ua)) {
      browser = 'Internet Explorer';
      browserVersion = RegExp.$1 || RegExp.$2;
    }

    const majorVersion = browserVersion.split('.')[0];
    const displayBrowser = majorVersion ? `${browser} ${majorVersion}` : browser;
    return { browser: displayBrowser, browserVersion };
  }

  private parseOs(ua: string): { os: string; osVersion: string } {
    let os = 'Unknown OS';
    let osVersion = '';

    if (/Windows NT 10\.0/i.test(ua)) {
      // Windows 10 or Windows 11
      os = 'Windows 10/11';
      osVersion = '10.0';
    } else if (/Windows NT 6\.3/i.test(ua)) {
      os = 'Windows 8.1';
      osVersion = '8.1';
    } else if (/Windows NT 6\.1/i.test(ua)) {
      os = 'Windows 7';
      osVersion = '7.0';
    } else if (/Mac OS X ([\d_]+)/i.test(ua)) {
      const ver = RegExp.$1.replace(/_/g, '.');
      os = 'macOS';
      osVersion = ver;
    } else if (/Android ([\d.]+)/i.test(ua)) {
      os = 'Android';
      osVersion = RegExp.$1;
    } else if (/iPhone OS ([\d_]+)/i.test(ua)) {
      const ver = RegExp.$1.replace(/_/g, '.');
      os = 'iOS';
      osVersion = ver;
    } else if (/iPad.*OS ([\d_]+)/i.test(ua)) {
      const ver = RegExp.$1.replace(/_/g, '.');
      os = 'iPadOS';
      osVersion = ver;
    } else if (/CrOS [a-zA-Z0-9_]+ ([\d.]+)/i.test(ua)) {
      os = 'ChromeOS';
      osVersion = RegExp.$1;
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
      osVersion = 'Standard';
    }

    const displayOs = osVersion && osVersion !== 'Standard' ? `${os} ${osVersion.split('.')[0]}` : os;
    return { os: displayOs, osVersion };
  }

  private parseDevice(ua: string, os: string): { device: string; deviceModel: string } {
    let device = 'Desktop';
    let deviceModel = 'Desktop PC';

    const isMobile = /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua));
    const isTV = /SmartTV|GoogleTV|AppleTV|HbbTV|Roku/i.test(ua);

    if (isTV) {
      device = 'Smart TV';
      deviceModel = 'Connected TV';
    } else if (isTablet) {
      device = 'Tablet';
      if (/iPad/i.test(ua)) deviceModel = 'Apple iPad';
      else deviceModel = 'Android Tablet';
    } else if (isMobile) {
      device = 'Mobile';
      if (/iPhone/i.test(ua)) deviceModel = 'Apple iPhone';
      else if (/Pixel ([\w\s]+)/i.test(ua)) deviceModel = `Google Pixel ${RegExp.$1}`;
      else if (/SM-([A-Za-z0-9]+)/i.test(ua)) deviceModel = `Samsung Galaxy (SM-${RegExp.$1})`;
      else if (/Xiaomi|Redmi|MI\s/i.test(ua)) deviceModel = 'Xiaomi Device';
      else if (/OnePlus/i.test(ua)) deviceModel = 'OnePlus Device';
      else if (/Huawei|Honor/i.test(ua)) deviceModel = 'Huawei Device';
      else deviceModel = 'Smartphone';
    } else {
      device = 'Desktop';
      if (/Macintosh|Mac OS/i.test(ua)) deviceModel = 'Apple Mac';
      else if (/Windows/i.test(ua)) deviceModel = 'Windows PC';
      else if (/Linux/i.test(ua)) deviceModel = 'Linux Workstation';
      else if (/CrOS/i.test(ua)) deviceModel = 'Chromebook';
    }

    return { device, deviceModel };
  }

  private async recordVisit(path: string): Promise<void> {
    try {
      const user = this.auth.currentUser;

      // Skip authenticated admin sessions so the visitor log reflects real visitors,
      // not the site owner's own browsing (which floods the log with one IP/location).
      if (user?.role === 'admin') return;

      const geo = await this.getGeoInfo();
      const dev = this.getDeviceInfo();

      const log: VisitorLog = {
        timestamp: Date.now(),
        dateStr: new Date().toLocaleString(),
        path: path || '/',

        // IP & Network / ISP info
        ip: geo.ip || 'Detecting...',
        ipType: geo.ipType || (geo.ip?.includes(':') ? 'IPv6' : 'IPv4'),
        isp: geo.isp || '',
        org: geo.org || '',
        asn: geo.asn || '',
        connectionType: dev.connectionType,
        downlink: dev.downlink,
        rtt: dev.rtt,

        // Precise Location
        city: geo.city || '',
        region: geo.region || '',
        country: geo.country || 'Global',
        countryCode: geo.countryCode || '',
        postal: geo.postal || '',
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: geo.timezoneOffset || '',
        flag: geo.flag || this.getFlagEmoji(geo.countryCode),

        // Device & System info
        device: dev.device,
        deviceModel: dev.deviceModel,
        browser: dev.browser,
        browserVersion: dev.browserVersion,
        os: dev.os,
        osVersion: dev.osVersion,
        screenResolution: dev.screenResolution,
        viewport: dev.viewport,
        pixelRatio: dev.pixelRatio,
        colorDepth: dev.colorDepth,
        orientation: dev.orientation,
        cpuCores: dev.cpuCores,
        ram: dev.ram || '',
        language: dev.language || 'en',
        touchSupport: !!dev.touchSupport,

        // User & Session Identity
        userId: user?.uid || null,
        userEmail: user?.email || 'Anonymous Visitor',
        visitorId: this.getVisitorId(),
        userAgent: dev.userAgent || '',
        referrer: document.referrer || ''
      };

      // Strip any undefined keys to guarantee Firebase RTDB compatibility
      const cleanLog: Record<string, any> = {};
      for (const [key, value] of Object.entries(log)) {
        if (value !== undefined) {
          cleanLog[key] = value;
        }
      }

      const logsRef = ref(this.firebase.db, 'visitor_logs');
      await push(logsRef, cleanLog);
    } catch (err) {
      console.warn('Visitor tracking skipped or failed:', err);
    }
  }

  getLogs(): Observable<VisitorLog[]> {
    return this.getRecentLogs();
  }

  getRecentLogs(): Observable<VisitorLog[]> {
    return new Observable<VisitorLog[]>(observer => {
      const logsRef = ref(this.firebase.db, 'visitor_logs');
      const listener = onValue(
        logsRef,
        snapshot => {
          this.zone.run(() => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              const logs: VisitorLog[] = Object.entries(data).map(([id, val]) => ({
                ...(val as VisitorLog),
                id
              }));
              logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              observer.next(logs);
            } else {
              observer.next([]);
            }
          });
        },
        error => {
          console.warn('Visitor logs retrieval warning:', error);
          this.zone.run(() => observer.next([]));
        }
      );

      return () => off(logsRef, 'value', listener);
    });
  }

  getVisitorStats(): Observable<VisitorStats> {
    return new Observable<VisitorStats>(observer => {
      const logsRef = ref(this.firebase.db, 'visitor_logs');
      const listener = onValue(
        logsRef,
        snapshot => {
          this.zone.run(() => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              const logs: VisitorLog[] = Object.entries(data).map(([id, val]) => ({
                ...(val as VisitorLog),
                id
              }));
              logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

              const totalVisits = logs.length;
              const uniqueIps = new Set(logs.map(l => l.ip).filter(ip => ip && ip !== 'Detecting...' && ip !== 'Unknown IP'));
              const uniqueVisitors = uniqueIps.size || totalVisits;

              // Compute top pages
              const pageCounts: Record<string, number> = {};
              for (const log of logs) {
                const p = (log.path || '/').split('?')[0];
                pageCounts[p] = (pageCounts[p] || 0) + 1;
              }

              const topPages = Object.entries(pageCounts)
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

              observer.next({
                totalVisits,
                uniqueVisitors,
                topPages,
                recentLogs: logs.slice(0, 100)
              });
            } else {
              observer.next({
                totalVisits: 0,
                uniqueVisitors: 0,
                topPages: [],
                recentLogs: []
              });
            }
          });
        },
        error => {
          console.warn('Visitor stats retrieval warning:', error);
          this.zone.run(() => observer.next({
            totalVisits: 0,
            uniqueVisitors: 0,
            topPages: [],
            recentLogs: []
          }));
        }
      );

      return () => off(logsRef, 'value', listener);
    });
  }

  getCurrentIp(): string | null {
    if (this.cachedGeo && this.cachedGeo.ip && this.cachedGeo.ip !== 'Detecting...' && this.cachedGeo.ip !== 'Unknown IP') {
      return this.cachedGeo.ip;
    }
    return null;
  }

  getVisitorId(): string {
    if (typeof window === 'undefined') return 'srv';
    try {
      let vid = localStorage.getItem('netmirrorbd_visitor_id');
      if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('netmirrorbd_visitor_id', vid);
      }
      return vid;
    } catch {
      return 'v_anon';
    }
  }

  async clearLogs(): Promise<void> {
    const logsRef = ref(this.firebase.db, 'visitor_logs');
    await remove(logsRef);
  }
}

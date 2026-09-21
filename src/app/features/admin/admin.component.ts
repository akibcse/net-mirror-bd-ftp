import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable, of, catchError, tap } from 'rxjs';
import { ref, onValue, off, remove, get } from 'firebase/database';
import { VisitorLogService, DetailedGeoData } from '../../services/visitor-log.service';
import { AuthService } from '../../services/auth.service';
import { FirebaseService } from '../../services/firebase.service';
import { SettingsService } from '../../services/settings.service';
import { VisitorLog, VisitorStats } from '../../models/visitor-log.model';
import { AppUser } from '../../models/user.model';

export interface BrokenReport {
  id?: string;
  mediaId: number;
  title: string;
  server: string;
  reason: string;
  season?: number;
  episode?: number;
  reportedBy: string;
  timestamp: number;
  dateStr: string;
}

export interface IpLogGroup {
  ip: string;
  ipType?: string;
  isp?: string;
  asn?: string | number;
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  flag?: string;
  latitude?: number;
  longitude?: number;
  count: number;
  lastSeen: number;
  devicesLabel: string;
  userEmail?: string;
  logs: VisitorLog[];
}

export interface StreamingServerConfig {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'maintenance';
  priority: number;
  enabled: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminComponent {
  private readonly visitorService = inject(VisitorLogService);
  private readonly authService = inject(AuthService);
  private readonly firebase = inject(FirebaseService);
  private readonly settingsService = inject(SettingsService);

  readonly siteName$ = this.settingsService.settings$.pipe(map(s => s.siteName || 'Net Mirror BD'));

  readonly activeTab = signal<'logs' | 'users' | 'servers' | 'reports' | 'system'>('logs');
  readonly searchQuery = signal('');
  private readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly isClearing = signal(false);
  readonly actionMessage = signal<string | null>(null);

  // Expanded unique-IP groups (click a group header to show its access logs)
  readonly expandedGroups = signal<Set<string>>(new Set());
  readonly currentGroups = signal<IpLogGroup[]>([]);

  // Selected log for detailed telemetry dossier modal
  readonly selectedLog = signal<VisitorLog | null>(null);
  readonly selectedUserHistory = signal<any[]>([]);
  readonly selectedUserSearches = signal<any[]>([]);
  readonly isLoadingHistory = signal<boolean>(false);

  // Streaming Servers Config (State)
  readonly servers = signal<StreamingServerConfig[]>([
    { id: 'vidsrc-me', name: 'VidSrc Prime (Server 1 - Default)', status: 'online', priority: 1, enabled: true },
    { id: 'vidsrc-cc', name: 'VidSrc CC (Server 2)', status: 'online', priority: 2, enabled: true },
    { id: 'multiembed', name: 'MultiEmbed (Server 3)', status: 'online', priority: 3, enabled: true },
    { id: 'autoembed', name: 'AutoEmbed Fast (Server 4)', status: 'online', priority: 4, enabled: true }
  ]);

  readonly stats$: Observable<VisitorStats> = this.visitorService.getVisitorStats();
  readonly allUsers$: Observable<AppUser[]> = this.authService.getAllUsers();
  readonly currentUser$: Observable<AppUser | null> = this.authService.currentUser$;

  readonly adminCount$: Observable<number> = this.allUsers$.pipe(
    map(users => users.filter(u => u.role === 'admin').length)
  );

  readonly sortColumn$ = new BehaviorSubject<'time' | 'ip' | 'location' | 'device' | 'visits'>('time');
  readonly sortDirection$ = new BehaviorSubject<'asc' | 'desc'>('desc');

  get sortColumn(): 'time' | 'ip' | 'location' | 'device' | 'visits' {
    return this.sortColumn$.value;
  }

  get sortDirection(): 'asc' | 'desc' {
    return this.sortDirection$.value;
  }

  toggleSort(col: 'time' | 'ip' | 'location' | 'device' | 'visits'): void {
    if (this.sortColumn$.value === col) {
      this.sortDirection$.next(this.sortDirection$.value === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn$.next(col);
      this.sortDirection$.next(col === 'time' || col === 'visits' ? 'desc' : 'asc');
    }
  }

  getSortIcon(col: 'time' | 'ip' | 'location' | 'device' | 'visits'): string {
    if (this.sortColumn$.value !== col) return '↕';
    return this.sortDirection$.value === 'asc' ? '▲' : '▼';
  }

  readonly logGroups$: Observable<IpLogGroup[]> = combineLatest([
    this.visitorService.getRecentLogs().pipe(catchError(() => of([]))),
    this.searchQuery$,
    this.sortColumn$,
    this.sortDirection$
  ]).pipe(
    map(([logs, query, sortCol, sortDir]) => {
      const q = (query || '').toLowerCase().trim();
      const filtered = q ? logs.filter(l => this.matchesQuery(l, q)) : logs;
      const groups = this.groupLogsByIp(filtered);

      // Sort unique IP groups based on the selected column and direction
      groups.sort((a, b) => {
        let cmp = 0;
        switch (sortCol) {
          case 'time':
            cmp = (a.lastSeen || 0) - (b.lastSeen || 0);
            break;
          case 'ip':
            cmp = a.ip.localeCompare(b.ip, undefined, { numeric: true });
            break;
          case 'location': {
            const locA = `${a.country || ''} ${a.city || ''}`.trim();
            const locB = `${b.country || ''} ${b.city || ''}`.trim();
            cmp = locA.localeCompare(locB);
            break;
          }
          case 'device':
            cmp = (a.devicesLabel || '').localeCompare(b.devicesLabel || '');
            break;
          case 'visits':
            cmp = (a.count || 0) - (b.count || 0);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });

      // Synchronize child log sort order within groups
      for (const g of groups) {
        g.logs.sort((a, b) => {
          const tA = a.timestamp || 0;
          const tB = b.timestamp || 0;
          return sortDir === 'asc' ? tA - tB : tB - tA;
        });
      }

      return groups;
    }),
    tap(groups => this.currentGroups.set(groups))
  );

  private matchesQuery(l: VisitorLog, q: string): boolean {
    return !!(
      (l.ip ?? '').toLowerCase().includes(q) ||
      (l.isp ?? '').toLowerCase().includes(q) ||
      (l.org ?? '').toLowerCase().includes(q) ||
      (l.asn ? String(l.asn).toLowerCase().includes(q) : false) ||
      (l.path ?? '').toLowerCase().includes(q) ||
      (l.country ?? '').toLowerCase().includes(q) ||
      (l.countryCode ?? '').toLowerCase().includes(q) ||
      (l.city ?? '').toLowerCase().includes(q) ||
      (l.region ?? '').toLowerCase().includes(q) ||
      (l.postal ?? '').toLowerCase().includes(q) ||
      (l.browser ?? '').toLowerCase().includes(q) ||
      (l.os ?? '').toLowerCase().includes(q) ||
      (l.device ?? '').toLowerCase().includes(q) ||
      (l.deviceModel ?? '').toLowerCase().includes(q) ||
      (l.userEmail ?? '').toLowerCase().includes(q)
    );
  }

  /** Aggregate flat logs into unique-IP groups, newest activity first */
  private groupLogsByIp(logs: VisitorLog[]): IpLogGroup[] {
    const byIp = new Map<string, IpLogGroup>();

    for (const log of logs) {
      const ip = log.ip || 'Unknown IP';
      let group = byIp.get(ip);
      if (!group) {
        group = {
          ip,
          ipType: log.ipType,
          isp: log.isp || log.org || '',
          asn: log.asn || '',
          country: log.country,
          countryCode: log.countryCode,
          city: log.city,
          region: log.region,
          flag: log.flag,
          latitude: log.latitude,
          longitude: log.longitude,
          count: 0,
          lastSeen: 0,
          devicesLabel: '',
          logs: []
        };
        byIp.set(ip, group);
      }

      group.count++;
      if (log.timestamp && log.timestamp > group.lastSeen) {
        group.lastSeen = log.timestamp;
      }
      group.logs.push(log);

      // Fill geo/ISP gaps from the most informative entry in the group
      if (!group.country && log.country) {
        group.country = log.country;
        group.countryCode = log.countryCode;
        group.city = log.city;
        group.region = log.region;
        group.flag = log.flag;
        group.latitude = log.latitude;
        group.longitude = log.longitude;
      }
      if (!group.isp && (log.isp || log.org)) {
        group.isp = log.isp || log.org || '';
        group.asn = log.asn || group.asn;
      }
      if (log.userId && !group.userEmail) {
        group.userEmail = log.userEmail || 'Member';
      }
    }

    const groups = [...byIp.values()];
    for (const g of groups) {
      g.logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      g.devicesLabel = Array.from(new Set(g.logs.map(l => l.device || 'Unknown Device'))).join(', ');
    }
    groups.sort((a, b) => b.lastSeen - a.lastSeen);
    return groups;
  }

  isGroupExpanded(ip: string): boolean {
    return this.expandedGroups().has(ip);
  }

  toggleGroup(ip: string): void {
    this.expandedGroups.update(set => {
      const next = new Set(set);
      if (next.has(ip)) {
        next.delete(ip);
      } else {
        next.add(ip);
      }
      return next;
    });
  }

  expandAllGroups(): void {
    this.expandedGroups.set(new Set(this.currentGroups().map(g => g.ip)));
  }

  collapseAllGroups(): void {
    this.expandedGroups.set(new Set());
  }

  readonly brokenReports$: Observable<BrokenReport[]> = new Observable<BrokenReport[]>(observer => {
    const reportsRef = ref(this.firebase.db, 'broken_stream_reports');
    const listener = onValue(
      reportsRef,
      snap => {
        if (snap.exists()) {
          const data = snap.val();
          const list: BrokenReport[] = Object.entries(data).map(([id, val]) => ({
            ...(val as BrokenReport),
            id
          }));
          list.sort((a, b) => b.timestamp - a.timestamp);
          observer.next(list);
        } else {
          observer.next([]);
        }
      },
      err => observer.error(err)
    );

    return () => off(reportsRef, 'value', listener);
  });

  setTab(tab: 'logs' | 'users' | 'servers' | 'reports' | 'system'): void {
    this.activeTab.set(tab);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.searchQuery.set(val);
    this.searchQuery$.next(val);
  }

  async openLogDetails(log: VisitorLog): Promise<void> {
    this.selectedLog.set(log);
    this.selectedUserHistory.set([]);
    this.selectedUserSearches.set([]);
    this.isLoadingHistory.set(true);

    const historyPromises: Promise<any[]>[] = [];
    const searchPromises: Promise<any[]>[] = [];

    // 1. Fetch by user ID (if visitor was signed in)
    if (log.userId) {
      historyPromises.push(
        get(ref(this.firebase.db, `user_activity/${log.userId}/history`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
      searchPromises.push(
        get(ref(this.firebase.db, `user_activity/${log.userId}/searches`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
    }

    // 2. Fetch by visitor IP (sanitized key)
    if (log.ip && log.ip !== 'Detecting...' && log.ip !== 'Unknown IP') {
      const ipKey = log.ip.replace(/[\.\#\$\/\[\]\:\s]/g, '_');
      historyPromises.push(
        get(ref(this.firebase.db, `visitor_activity/${ipKey}/history`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
      searchPromises.push(
        get(ref(this.firebase.db, `visitor_activity/${ipKey}/searches`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
    }

    // 3. Fetch by visitorId (if available)
    if (log.visitorId) {
      const vidKey = log.visitorId.replace(/[\.\#\$\/\[\]\:\s]/g, '_');
      historyPromises.push(
        get(ref(this.firebase.db, `visitor_activity/${vidKey}/history`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
      searchPromises.push(
        get(ref(this.firebase.db, `visitor_activity/${vidKey}/searches`))
          .then(snap => snap.exists() ? Object.values(snap.val() as Record<string, any>) : [])
          .catch(() => [])
      );
    }

    try {
      const [allHistories, allSearches] = await Promise.all([
        Promise.all(historyPromises),
        Promise.all(searchPromises)
      ]);

      // Flatten and deduplicate watch history
      const histMap = new Map<string, any>();
      for (const item of allHistories.flat()) {
        if (!item) continue;
        const key = String(item.id || item.mediaId || item.title || JSON.stringify(item));
        const itemTime = item.watchedAt || item.timestamp || 0;
        const existing = histMap.get(key);
        const existTime = existing ? (existing.watchedAt || existing.timestamp || 0) : 0;
        if (!existing || itemTime > existTime) {
          histMap.set(key, item);
        }
      }
      const sortedHistory = Array.from(histMap.values())
        .sort((a, b) => (b.watchedAt || b.timestamp || 0) - (a.watchedAt || a.timestamp || 0))
        .slice(0, 30);
      this.selectedUserHistory.set(sortedHistory);

      // Flatten and deduplicate search queries
      const searchMap = new Map<string, any>();
      for (const item of allSearches.flat()) {
        if (!item || (!item.query && !item.q)) continue;
        const qText = (item.query || item.q || '').trim();
        if (!qText) continue;
        const qKey = qText.toLowerCase();
        const itemTime = item.timestamp || 0;
        const existing = searchMap.get(qKey);
        const existTime = existing ? (existing.timestamp || 0) : 0;
        if (!existing || itemTime > existTime) {
          searchMap.set(qKey, item);
        }
      }
      const sortedSearches = Array.from(searchMap.values())
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 30);
      this.selectedUserSearches.set(sortedSearches);
    } catch (err) {
      console.warn('Failed to load visitor activity:', err);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  closeLogDetails(): void {
    this.selectedLog.set(null);
  }

  copyText(text?: string, label: string = 'Text'): void {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showTemporaryNotice(`Copied ${label} to clipboard!`);
      });
    }
  }

  async toggleRole(user: AppUser): Promise<void> {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role for ${user.email} to ${newRole.toUpperCase()}?`)) return;

    try {
      await this.authService.updateUserRole(user.uid, newRole);
      this.showTemporaryNotice(`Updated ${user.email} role to ${newRole}`);
    } catch (err: any) {
      alert(`Failed to update role: ${err?.message}`);
    }
  }

  toggleServer(serverId: string): void {
    this.servers.update(list =>
      list.map(s => (s.id === serverId ? { ...s, enabled: !s.enabled } : s))
    );
    this.showTemporaryNotice('Streaming server status updated.');
  }

  async deleteReport(reportId?: string): Promise<void> {
    if (!reportId) return;
    await remove(ref(this.firebase.db, `broken_stream_reports/${reportId}`));
    this.showTemporaryNotice('Broken video report marked as resolved.');
  }

  async clearAllLogs(): Promise<void> {
    if (!confirm('Are you sure you want to clear all visitor tracking records?')) return;

    this.isClearing.set(true);
    try {
      await this.visitorService.clearLogs();
      this.showTemporaryNotice('All visitor logs cleared.');
    } catch (err: any) {
      alert(`Failed to clear logs: ${err?.message}`);
    } finally {
      this.isClearing.set(false);
    }
  }

  showTemporaryNotice(msg: string): void {
    this.actionMessage.set(msg);
    setTimeout(() => this.actionMessage.set(null), 3500);
  }

  formatDate(ts: number | undefined): string {
    return ts ? new Date(ts).toLocaleString() : 'N/A';
  }

  getRelativeTime(ts: number | undefined): string {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

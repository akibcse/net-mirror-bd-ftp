import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminMediaService } from '../../../../services/admin-media.service';
import { AdminLog } from '../../../../models/media.model';

type AuditCategory = 'all' | 'auth' | 'content' | 'config' | 'security' | 'system';

const ACTION_CATEGORY_MAP: Record<string, AuditCategory> = {
  'save_override':        'content',
  'delete_override':      'content',
  'import_tmdb':          'content',
  'bulk_import':          'content',
  'auto_import':          'content',
  'toggle_featured':      'content',
  'toggle_published':     'content',
  'save_server':          'config',
  'delete_server':        'config',
  'save_homepage_config': 'config',
  'save_seo':             'config',
  'save_settings':        'config',
  'save_genre':           'config',
  'delete_genre':         'config',
  'save_ad':              'config',
  'delete_ad':            'config',
  'send_notification':    'system',
  'delete_notification':  'system',
  'delete_review':        'content',
  'moderate_review':      'content',
  'admin_login':          'auth',
  'admin_logout':         'auth',
  'user_role_change':     'security',
  'user_edit':            'security',
  'user_delete':          'security',
  'clear_logs':           'system',
  'export_logs':          'system',
};

function getCategoryForAction(action: string): AuditCategory {
  return ACTION_CATEGORY_MAP[action] || 'system';
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    'save_override':        '💾',
    'delete_override':      '🗑️',
    'import_tmdb':          '📥',
    'bulk_import':          '📦',
    'auto_import':          '🤖',
    'toggle_featured':      '⭐',
    'toggle_published':     '📢',
    'save_server':          '🖥️',
    'delete_server':        '🗑️',
    'save_homepage_config': '🏠',
    'save_seo':             '🔍',
    'save_settings':        '⚙️',
    'save_genre':           '🏷️',
    'delete_genre':         '🗑️',
    'save_ad':              '📣',
    'delete_ad':            '🗑️',
    'send_notification':    '🔔',
    'delete_notification':  '🗑️',
    'delete_review':        '💬',
    'moderate_review':      '🛡️',
    'admin_login':          '🔐',
    'admin_logout':         '🚪',
    'user_role_change':     '👑',
    'user_edit':            '✏️',
    'user_delete':          '❌',
    'clear_logs':           '🧹',
    'export_logs':          '📤',
  };
  return icons[action] || '📋';
}

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-page">
      <div class="page-header">
        <div>
          <h1>🛡️ System Audit Trail</h1>
          <p>Comprehensive chronological log of all administrative activities, security events, content changes, and configuration updates.</p>
        </div>
        <div class="header-actions">
          <button class="btn-refresh" (click)="refresh()" title="Refresh logs">
            🔄 Refresh
          </button>
          <button class="btn-export" (click)="exportLogs()">
            💾 Export JSON
          </button>
        </div>
      </div>

      <!-- CATEGORY FILTER TABS -->
      <div class="category-tabs">
        <button
          *ngFor="let cat of categories"
          class="cat-tab"
          [class.active]="activeCategory === cat.id"
          (click)="activeCategory = cat.id; applyFilters()"
        >
          {{ cat.icon }} {{ cat.label }}
          <span class="cat-count">{{ getCategoryCount(cat.id) }}</span>
        </button>
      </div>

      <!-- SEARCH + COUNT -->
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon-pre">🔍</span>
          <input
            type="text"
            placeholder="Filter by action, user, target, IP, or location..."
            [(ngModel)]="searchFilter"
            (ngModelChange)="applyFilters()"
            class="form-control"
          />
        </div>
        <div class="log-stats">
          <span class="stat-pill">{{ filteredLogs.length }} entries</span>
          <span class="stat-pill stat-total">{{ logs.length }} total</span>
        </div>
      </div>

      <!-- AUDIT TABLE -->
      <div class="table-card">
        <table class="data-table" *ngIf="filteredLogs.length > 0; else emptyState">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Category</th>
              <th>Action</th>
              <th>Target</th>
              <th>Administrator</th>
              <th>IP & Location</th>
              <th>Device</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of filteredLogs" [class]="'row-' + getLevel(log)">
              <td class="time-cell">
                <div class="time-main">{{ log.timestamp | date:'dd MMM yy' }}</div>
                <div class="time-sub">{{ log.timestamp | date:'HH:mm:ss' }}</div>
              </td>
              <td>
                <span class="cat-badge" [class]="'cat-' + getCategoryForAction(log.action)">
                  {{ getCategoryLabel(log.action) }}
                </span>
              </td>
              <td>
                <div class="action-row">
                  <span class="action-icon">{{ getActionIcon(log.action) }}</span>
                  <span class="action-tag">{{ log.action }}</span>
                </div>
              </td>
              <td>
                <span class="target-text" *ngIf="log.target; else noTarget">{{ log.target }}</span>
                <ng-template #noTarget><span class="dash">—</span></ng-template>
              </td>
              <td class="admin-cell">
                <div class="admin-row">
                  <span class="admin-avatar">{{ (log.adminEmail || 'A').charAt(0).toUpperCase() }}</span>
                  <span class="admin-email">{{ log.adminEmail }}</span>
                </div>
              </td>
              <td>
                <div class="ip-loc-cell" *ngIf="log.ip || log.location; else noIp">
                  <span class="log-ip" *ngIf="log.ip">{{ log.ip }}</span>
                  <span class="log-loc" *ngIf="log.location">📍 {{ log.location }}</span>
                  <span class="log-isp" *ngIf="log.isp">⚡ {{ log.isp }}</span>
                </div>
                <ng-template #noIp><span class="dash">—</span></ng-template>
              </td>
              <td>
                <span class="log-device" *ngIf="log.device; else noDev">💻 {{ log.device }}</span>
                <ng-template #noDev><span class="dash">—</span></ng-template>
              </td>
              <td class="details-cell">
                <span [title]="log.details || ''">{{ log.details || '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #emptyState>
          <div class="empty-state">
            <span class="empty-icon">🛡️</span>
            <p>No audit log entries match the current filters.</p>
            <small>Admin activities such as login, content changes, configuration updates and security events will appear here.</small>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .audit-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
    .page-header h1 { font-size: 1.75rem; color: #ffffff; margin: 0; }
    .page-header p { color: #94a3b8; margin: 0.35rem 0 0; font-size: 0.88rem; max-width: 600px; }
    .header-actions { display: flex; gap: 0.75rem; }
    .btn-refresh {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      padding: 0.6rem 1.1rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-refresh:hover { background: rgba(255,255,255,0.14); }
    .btn-export {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      color: white;
      padding: 0.6rem 1.1rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-export:hover { opacity: 0.9; }

    /* Category tabs */
    .category-tabs {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .cat-tab {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      font-size: 0.83rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .cat-tab:hover { background: rgba(255,255,255,0.09); color: #fff; }
    .cat-tab.active {
      background: rgba(99,102,241,0.2);
      border-color: rgba(99,102,241,0.5);
      color: #a5b4fc;
    }
    .cat-count {
      background: rgba(255,255,255,0.12);
      border-radius: 9999px;
      padding: 1px 6px;
      font-size: 0.74rem;
      color: #cbd5e1;
    }

    /* Toolbar */
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .search-wrap { position: relative; flex: 1; max-width: 500px; }
    .search-icon-pre { position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #64748b; }
    .form-control {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 0.65rem 0.85rem 0.65rem 2.4rem;
      color: white;
      outline: none;
      width: 100%;
      font-size: 0.9rem;
    }
    .form-control:focus { border-color: #6366f1; }
    .log-stats { display: flex; gap: 0.5rem; }
    .stat-pill {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .stat-total { color: #6366f1; }

    /* Table */
    .table-card {
      background: rgba(17, 24, 39, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow-x: auto;
    }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.87rem; }
    .data-table th {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: #64748b;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .data-table td {
      padding: 0.8rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #e2e8f0;
      vertical-align: middle;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: rgba(255,255,255,0.02); }

    /* Row level colors */
    .row-warn td { background: rgba(234,179,8,0.03); }
    .row-error td { background: rgba(239,68,68,0.04); }

    /* Time */
    .time-cell { white-space: nowrap; }
    .time-main { font-size: 0.82rem; color: #fff; font-weight: 600; }
    .time-sub { font-size: 0.75rem; color: #64748b; font-family: monospace; }

    /* Category badge */
    .cat-badge {
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .cat-auth { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
    .cat-content { background: rgba(139,92,246,0.15); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.3); }
    .cat-config { background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
    .cat-security { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
    .cat-system { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
    .cat-all { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }

    /* Action */
    .action-row { display: flex; align-items: center; gap: 0.5rem; }
    .action-icon { font-size: 1rem; }
    .action-tag {
      background: rgba(99, 102, 241, 0.12);
      color: #a5b4fc;
      padding: 2px 7px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 0.78rem;
    }

    .target-text { color: #e2e8f0; font-size: 0.82rem; max-width: 160px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dash { color: #475569; }

    /* Admin */
    .admin-row { display: flex; align-items: center; gap: 0.5rem; }
    .admin-avatar {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
    }
    .admin-email { font-size: 0.82rem; color: #cbd5e1; }

    /* IP / Location */
    .ip-loc-cell { display: flex; flex-direction: column; gap: 2px; }
    .log-ip { font-family: monospace; font-size: 0.8rem; color: #ffffff; }
    .log-loc { font-size: 0.74rem; color: #94a3b8; }
    .log-isp { font-size: 0.72rem; color: #38bdf8; }
    .log-device { font-size: 0.78rem; color: #cbd5e1; }

    .details-cell { max-width: 220px; }
    .details-cell span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem; color: #94a3b8; }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .empty-icon { font-size: 3rem; }
    .empty-state p { color: #94a3b8; font-size: 1rem; margin: 0; }
    .empty-state small { color: #64748b; font-size: 0.82rem; max-width: 400px; }
  `]
})
export class AdminLogsComponent implements OnInit {
  private readonly adminMedia = inject(AdminMediaService);
  private readonly cdr = inject(ChangeDetectorRef);

  logs: AdminLog[] = [];
  filteredLogs: AdminLog[] = [];
  searchFilter = '';
  activeCategory: AuditCategory = 'all';

  readonly categories = [
    { id: 'all' as AuditCategory,      icon: '📋', label: 'All Events' },
    { id: 'auth' as AuditCategory,     icon: '🔐', label: 'Auth' },
    { id: 'content' as AuditCategory,  icon: '🎬', label: 'Content' },
    { id: 'config' as AuditCategory,   icon: '⚙️', label: 'Config' },
    { id: 'security' as AuditCategory, icon: '🛡️', label: 'Security' },
    { id: 'system' as AuditCategory,   icon: '🔧', label: 'System' },
  ];

  getCategoryForAction = getCategoryForAction;
  getActionIcon = getActionIcon;

  getCategoryCount(cat: AuditCategory): number {
    if (cat === 'all') return this.logs.length;
    return this.logs.filter(l => getCategoryForAction(l.action) === cat).length;
  }

  getCategoryLabel(action: string): string {
    const cat = getCategoryForAction(action);
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  getLevel(log: AdminLog): string {
    return log.level || 'info';
  }

  ngOnInit(): void {
    this.loadLogs();
  }

  async loadLogs(): Promise<void> {
    this.logs = await this.adminMedia.getLogs(500);
    this.applyFilters();
    this.cdr.detectChanges();
  }

  async refresh(): Promise<void> {
    await this.loadLogs();
  }

  applyFilters(): void {
    let result = [...this.logs];

    // Category filter
    if (this.activeCategory !== 'all') {
      result = result.filter(l => getCategoryForAction(l.action) === this.activeCategory);
    }

    // Search filter
    const q = (this.searchFilter || '').toLowerCase().trim();
    if (q) {
      result = result.filter(l =>
        (l.action || '').toLowerCase().includes(q) ||
        (l.target || '').toLowerCase().includes(q) ||
        (l.adminEmail || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q) ||
        (l.isp || '').toLowerCase().includes(q) ||
        (l.device || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q)
      );
    }

    this.filteredLogs = result;
    this.cdr.detectChanges();
  }

  exportLogs(): void {
    const dataStr = 'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(this.filteredLogs, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `Net Mirror BD-audit-trail-${Date.now()}.json`);
    dlAnchor.click();
  }
}

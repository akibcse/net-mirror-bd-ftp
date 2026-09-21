import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { AdminMediaService } from '../../../../services/admin-media.service';
import { MovieService } from '../../../../services/movie.service';
import { AnalyticsService } from '../../../../services/analytics.service';
import { VisitorLogService } from '../../../../services/visitor-log.service';
import {
  AdminLog,
  AutoImportCategory,
  AutoImportMediaType,
  AutoImportOptions,
  AutoImportProgress
} from '../../../../models/media.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="dashboard-wrap">
      <!-- WELCOME BANNER -->
      <div class="welcome-banner">
        <div>
          <h1>Welcome back, Admin 👋</h1>
          <p>Here is what's happening on Net Mirror BD today.</p>
        </div>
        <div class="quick-buttons">
          <a routerLink="/admin/analytics" class="btn-quick primary">
            <span>📊</span> Analytics
          </a>
          <a routerLink="/admin/servers" class="btn-quick secondary">
            <span>🖥️</span> Stream Servers
          </a>
          <a routerLink="/admin/notifications" class="btn-quick glow-btn">
            <span>🔔</span> Push Notify
          </a>
        </div>
      </div>

      <!-- METRICS TILES -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-icon users-icon">👥</div>
          <div class="metric-data">
            <span class="metric-value">{{ totalUsers }}</span>
            <span class="metric-label">Total Users</span>
          </div>
          <div class="metric-trend up">+ Active</div>
        </div>

        <div class="metric-card">
          <div class="metric-icon visitors-icon">👁️</div>
          <div class="metric-data">
            <span class="metric-value">{{ totalVisitors }}</span>
            <span class="metric-label">Visitor Sessions</span>
          </div>
          <div class="metric-trend up">Live logged</div>
        </div>

        <div class="metric-card">
          <div class="metric-icon movies-icon">🎬</div>
          <div class="metric-data">
            <span class="metric-value">{{ totalOverrides }}</span>
            <span class="metric-label">Catalog Overrides</span>
          </div>
          <div class="metric-trend">Custom CMS</div>
        </div>

        <div class="metric-card">
          <div class="metric-icon servers-icon">🖥️</div>
          <div class="metric-data">
            <span class="metric-value">{{ activeServers }}</span>
            <span class="metric-label">Active Stream Servers</span>
          </div>
          <div class="metric-trend up">100% Online</div>
        </div>
      </div>

      <!-- TWO COLUMN SECTION -->
      <div class="dashboard-columns">
        <!-- RECENT AUDIT LOGS -->
        <div class="dash-card">
          <div class="card-header">
            <h3>Recent Audit Trail</h3>
            <a routerLink="/admin/logs" class="link-more">View All →</a>
          </div>

          <div class="logs-list" *ngIf="recentLogs.length > 0; else noLogs">
            <div *ngFor="let log of recentLogs" class="log-item">
              <div class="log-badge">{{ log.action }}</div>
              <div class="log-meta">
                <span class="log-target">{{ log.target }}</span>
                <span class="log-detail" *ngIf="log.details">{{ log.details }}</span>
                <span class="log-time">{{ log.timestamp | date:'short' }}</span>
              </div>
            </div>
          </div>
          <ng-template #noLogs>
            <div class="empty-box">No recent admin logs found.</div>
          </ng-template>
        </div>

        <!-- QUICK SYSTEM STATUS & ACTIONS -->
        <div class="dash-card">
          <div class="card-header">
            <h3>Platform Modules</h3>
          </div>

          <div class="modules-grid">
            <a routerLink="/admin/movies" class="module-link">
              <span class="mod-icon">🎬</span>
              <div>
                <strong>Movie Manager</strong>
                <p>Import & curate titles</p>
              </div>
            </a>

            <a routerLink="/admin/tv" class="module-link">
              <span class="mod-icon">📺</span>
              <div>
                <strong>TV Series</strong>
                <p>Seasons & episodes</p>
              </div>
            </a>

            <a routerLink="/admin/servers" class="module-link">
              <span class="mod-icon">🖥️</span>
              <div>
                <strong>Stream Providers</strong>
                <p>Embed servers & priority</p>
              </div>
            </a>

            <a routerLink="/admin/users" class="module-link">
              <span class="mod-icon">👥</span>
              <div>
                <strong>User Accounts</strong>
                <p>Roles & access control</p>
              </div>
            </a>

            <a routerLink="/admin/reviews" class="module-link">
              <span class="mod-icon">💬</span>
              <div>
                <strong>Reviews & Moderation</strong>
                <p>Community feedback</p>
              </div>
            </a>

            <a routerLink="/admin/seo" class="module-link">
              <span class="mod-icon">🔍</span>
              <div>
                <strong>SEO & Tags</strong>
                <p>Meta & schema config</p>
              </div>
            </a>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard-wrap {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .welcome-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(17, 24, 39, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 2rem;
      flex-wrap: wrap;
      gap: 1.5rem;
    }
    .welcome-banner h1 {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.35rem;
    }
    .welcome-banner p {
      color: #94a3b8;
      margin: 0;
      font-size: 0.95rem;
    }
    .quick-buttons {
      display: flex;
      gap: 0.75rem;
    }
    .btn-quick {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-quick.primary {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      border: none;
      cursor: pointer;
    }
    .btn-quick.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.12);
      cursor: pointer;
    }
    .btn-quick.glow-btn {
      background: linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(139,92,246,0.4);
      animation: glow 2.5s ease-in-out infinite alternate;
    }
    @keyframes glow {
      from { box-shadow: 0 4px 16px rgba(139,92,246,0.4); }
      to   { box-shadow: 0 6px 28px rgba(236,72,153,0.7); }
    }
    /* MODAL STYLES */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
    .modal-card { background: #111827; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .auto-import-card { max-width: 700px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .modal-title-wrap { display: flex; flex-direction: column; gap: 0.2rem; }
    .badge-accent { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: #a855f7; font-weight: 700; }
    .modal-header h3 { margin: 0; color: white; font-size: 1.25rem; font-weight: 700; }
    .btn-close { background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
    .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .section-desc { color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin: 0; }
    .form-group { display: flex; flex-direction: column; gap: 0.45rem; }
    .form-label { font-size: 0.8rem; font-weight: 600; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.04em; }
    .form-control { background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0.7rem 0.9rem; color: white; outline: none; width: 100%; font-size: 0.9rem; box-sizing: border-box; }
    .media-type-grid { display: flex; gap: 0.65rem; }
    .media-type-card { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 0.85rem; cursor: pointer; transition: all 0.15s; font-size: 1.4rem; }
    .media-type-card strong { font-size: 0.82rem; color: #e2e8f0; }
    .media-type-card:hover { background: rgba(255,255,255,0.06); }
    .media-type-card.selected { background: rgba(139,92,246,0.18); border-color: #a855f7; box-shadow: 0 0 14px rgba(168,85,247,0.3); }
    .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.6rem; }
    .category-card { display: flex; align-items: center; gap: 0.65rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.65rem 0.85rem; cursor: pointer; transition: all 0.15s; }
    .category-card:hover { background: rgba(255,255,255,0.06); }
    .category-card.selected { background: rgba(139,92,246,0.18); border-color: #a855f7; }
    .cat-icon { font-size: 1.2rem; }
    .cat-text { display: flex; flex-direction: column; }
    .cat-text strong { color: white; font-size: 0.83rem; }
    .cat-text small { color: #94a3b8; font-size: 0.7rem; }
    .limit-selector { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .btn-limit { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1; padding: 0.6rem 1rem; border-radius: 10px; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
    .btn-limit.active { background: #6366f1; border-color: #818cf8; color: white; }
    .custom-limit-input { width: 100px !important; text-align: center; }
    .checkbox-label { display: flex; align-items: flex-start; gap: 0.75rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 0.65rem 0.85rem; cursor: pointer; }
    .checkbox-label input[type="checkbox"] { margin-top: 3px; accent-color: #8b5cf6; width: 15px; height: 15px; }
    .checkbox-text { display: flex; flex-direction: column; }
    .checkbox-text strong { color: #f1f5f9; font-size: 0.83rem; }
    .checkbox-text small { color: #94a3b8; font-size: 0.72rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); }
    .btn-auto-import-start { display: inline-flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 700; font-size: 0.92rem; cursor: pointer; }
    /* PROGRESS */
    .progress-view { display: flex; flex-direction: column; gap: 1.25rem; }
    .progress-header { display: flex; justify-content: space-between; align-items: center; }
    .progress-title-status { display: flex; align-items: center; gap: 0.6rem; }
    .progress-title-status h4 { margin: 0; color: white; font-size: 1rem; }
    .status-indicator { width: 10px; height: 10px; border-radius: 50%; background: #64748b; }
    .status-indicator.running { background: #3b82f6; box-shadow: 0 0 10px #3b82f6; animation: pulse2 1.5s infinite; }
    .status-indicator.done { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
    .progress-percent-badge { background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.4); color: #c084fc; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; }
    .progress-track { width: 100%; height: 10px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6); border-radius: 6px; transition: width 0.25s ease; }
    .progress-fill.indeterminate { animation: indeterminate 1.5s infinite linear; width: 35% !important; }
    .live-stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.75rem; }
    .live-stat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.75rem; text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
    .live-stat-card.success .stat-num { color: #4ade80; }
    .live-stat-card.skipped .stat-num { color: #facc15; }
    .live-stat-card.error .stat-num { color: #f87171; }
    .stat-num { font-size: 1.35rem; font-weight: 800; }
    .stat-name { font-size: 0.72rem; color: #94a3b8; }
    .log-stream-wrap { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden; }
    .log-stream-body { max-height: 160px; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .log-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; padding: 2px 6px; }
    .log-time { color: #64748b; font-family: monospace; font-size: 0.7rem; }
    .log-tag { font-size: 0.72rem; font-weight: 700; }
    .log-row.log-success .log-tag { color: #4ade80; }
    .log-row.log-skipped .log-tag { color: #facc15; }
    .log-row.log-error .log-tag { color: #f87171; }
    .log-title { color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-empty { color: #64748b; text-align: center; padding: 0.75rem; font-size: 0.8rem; }
    .progress-actions { display: flex; justify-content: flex-end; }
    .btn-cancel { background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 0.65rem 1.25rem; border-radius: 10px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: linear-gradient(135deg,#22c55e,#16a34a); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 700; cursor: pointer; }
    .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 0.65rem 1.15rem; border-radius: 10px; cursor: pointer; }
    @keyframes pulse2 { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }
    .metric-card {
      background: rgba(17, 24, 39, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      position: relative;
    }
    .metric-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .users-icon { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .visitors-icon { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .movies-icon { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .servers-icon { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .metric-data {
      display: flex;
      flex-direction: column;
    }
    .metric-value {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }
    .metric-label {
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .metric-trend {
      position: absolute;
      top: 1rem;
      right: 1rem;
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }
    .metric-trend.up {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
    }
    .dashboard-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) {
      .dashboard-columns { grid-template-columns: 1fr; }
    }
    .dash-card {
      background: rgba(17, 24, 39, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.5rem;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 0.75rem;
    }
    .card-header h3 {
      font-size: 1.15rem;
      color: #ffffff;
      margin: 0;
    }
    .link-more {
      color: #a855f7;
      text-decoration: none;
      font-size: 0.85rem;
    }
    .logs-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .log-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(0, 0, 0, 0.25);
      padding: 0.75rem 1rem;
      border-radius: 10px;
    }
    .log-badge {
      font-size: 0.75rem;
      background: rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: monospace;
    }
    .log-meta {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .log-target { font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
    .log-detail { font-size: 0.75rem; color: #94a3b8; }
    .log-time { font-size: 0.7rem; color: #64748b; }
    .modules-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .module-link {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 0.85rem;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    .module-link:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-2px);
    }
    .mod-icon { font-size: 1.5rem; }
    .module-link strong { display: block; font-size: 0.9rem; color: #ffffff; }
    .module-link p { margin: 0; font-size: 0.75rem; color: #94a3b8; }
    .empty-box {
      text-align: center;
      color: #64748b;
      padding: 2rem;
      font-size: 0.9rem;
    }

    @media (max-width: 640px) {
      .welcome-banner {
        flex-direction: column;
        align-items: stretch;
        padding: 1.25rem;
        gap: 1rem;
      }
      .welcome-banner h1 {
        font-size: 1.45rem;
      }
      .quick-buttons {
        flex-direction: column;
        width: 100%;
      }
      .btn-quick {
        justify-content: center;
      }
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }
      .metric-card {
        padding: 1rem 0.85rem;
        gap: 0.75rem;
      }
      .metric-icon {
        width: 40px;
        height: 40px;
        font-size: 1.2rem;
      }
      .metric-value {
        font-size: 1.35rem;
      }
      .metric-trend {
        display: none;
      }
      .modules-grid {
        grid-template-columns: 1fr;
      }
      .dash-card {
        padding: 1rem;
      }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly adminMedia = inject(AdminMediaService);
  private readonly visitorLogs = inject(VisitorLogService);
  private readonly cdr = inject(ChangeDetectorRef);

  totalUsers = 0;
  totalVisitors = 0;
  totalOverrides = 0;
  activeServers = 0;
  recentLogs: AdminLog[] = [];

  ngOnInit(): void {
    this.auth.getAllUsers().subscribe(users => {
      this.totalUsers = users.length;
      this.cdr.detectChanges();
    });
    this.visitorLogs.getLogs().subscribe(logs => {
      this.totalVisitors = logs.length;
      this.cdr.detectChanges();
    });
    this.adminMedia.getAllOverrides().then(list => {
      this.totalOverrides = list.length;
      this.cdr.detectChanges();
    });
    this.adminMedia.getServers().then(servers => {
      this.activeServers = servers.filter(s => s.active).length;
      this.cdr.detectChanges();
    });
    this.adminMedia.getLogs(5).then(logs => {
      this.recentLogs = logs;
      this.cdr.detectChanges();
    });
  }
}

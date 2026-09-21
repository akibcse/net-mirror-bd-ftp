import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { ChatService } from '../../services/chat.service';
import { Subscription, filter } from 'rxjs';

const NAV_GROUPS = [
  { group: 'Overview', items: [
    { path: '/admin/dashboard',   label: 'Dashboard',           short: 'Home',      icon: 'grid',     color: '#6366f1' },
    { path: '/admin/analytics',   label: 'Analytics & Traffic', short: 'Analytics', icon: 'activity', color: '#10b981' },
    { path: '/admin/visitors',    label: 'Visitor Logs',        short: 'Visitors',  icon: 'eye',      color: '#06b6d4' },
  ]},
  { group: 'Content & Servers', items: [
    { path: '/admin/genres',   label: 'Genres & Tags',      short: 'Genres',  icon: 'tag',    color: '#f59e0b' },
    { path: '/admin/servers',  label: 'Streaming Servers',  short: 'Servers', icon: 'server', color: '#3b82f6' },
  ]},
  { group: 'Community', items: [
    { path: '/admin/users',    label: 'Users & Accounts',    short: 'Users',   icon: 'users',   color: '#14b8a6' },
    { path: '/admin/reviews',  label: 'Reviews Moderation',  short: 'Reviews', icon: 'message', color: '#f97316' },
    { path: '/admin/chat',     label: 'Live Chat',           short: 'Chat',    icon: 'chat',    color: '#10b981' },
  ]},
  { group: 'Configuration', items: [
    { path: '/admin/settings',      label: 'Site Settings',      short: 'Settings', icon: 'settings', color: '#64748b' },
    { path: '/admin/seo',           label: 'SEO & Metadata',     short: 'SEO',      icon: 'search',   color: '#0ea5e9' },
    { path: '/admin/ads',           label: 'Advertisements',     short: 'Ads',      icon: 'zap',      color: '#eab308' },
    { path: '/admin/notifications', label: 'Push Notifications', short: 'Notify',   icon: 'bell',     color: '#a855f7' },
    { path: '/admin/logs',          label: 'Audit Trail',        short: 'Audit',    icon: 'file',     color: '#ef4444' },
  ]},
];

const ICONS: Record<string, string> = {
  grid:        '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  activity:    '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  eye:         '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  film:        '<rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  tv:          '<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>',
  tag:         '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  server:      '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  users:       '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  message:     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield:      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search:      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  zap:         '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  chat:        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1"/><circle cx="12" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>',
  bell:        '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  file:        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  more:        '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  globe:       '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  logout:      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  panelLeft:   '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight:'<polyline points="9 18 15 12 9 6"/>',
  menu:        '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  x:           '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  apps:        '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sidebar:     '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 9 12 12 14 15"/>',
};

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-layout" [class.collapsed]="collapsed">

      <!-- ══════════════════════════════════════════
           DESKTOP SIDEBAR
      ══════════════════════════════════════════ -->
      <aside class="desk-sidebar" [class.collapsed]="collapsed">

        <!-- Sidebar Brand Header -->
        <div class="sidebar-brand" [class.is-collapsed]="collapsed">
          <div class="brand-row" [title]="siteName + ' Admin'">
            <img src="/logo-icon.png" alt="Net Mirror BDbd" class="admin-brand-icon" />
            <div class="brand-words" *ngIf="!collapsed">
              <span class="bw-name"><span class="bw-white">{{ brandFirst }}</span><span class="bw-red">{{ brandRest }}</span></span>
              <span class="bw-sub">Admin Control</span>
            </div>
          </div>

          <!-- Collapse Toggle Button (Expanded mode: right side; Collapsed mode: centered below) -->
          <button
            class="btn-col"
            (click)="toggleCollapse()"
            [title]="collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'"
            aria-label="Toggle sidebar collapse">
            <span [innerHTML]="svg(collapsed ? 'chevronRight' : 'chevronLeft', 16)"></span>
          </button>
        </div>

        <!-- Sidebar Navigation List -->
        <nav class="sidebar-nav">
          <ng-container *ngFor="let g of navGroups; let i = index">
            <div class="nav-sep" *ngIf="i > 0"></div>
            <div class="nav-grp" *ngIf="!collapsed">{{ g.group }}</div>
            <a *ngFor="let item of g.items"
               [routerLink]="item.path"
               routerLinkActive="active"
               class="nav-item"
               [title]="collapsed ? item.label : ''"
               (click)="closeDrawers()">
              <span class="n-icon" [innerHTML]="svg(item.icon, 18)"></span>
              <span class="n-label" *ngIf="!collapsed">{{ item.label }}</span>
              <ng-container *ngIf="item.path === '/admin/chat' && (chatUnread$ | async) as cnt">
                <span class="nav-unread-badge" *ngIf="cnt > 0">{{ cnt }}</span>
              </ng-container>
              <span class="n-tip" *ngIf="collapsed">{{ item.label }}</span>
            </a>
          </ng-container>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-foot">
          <a routerLink="/" class="btn-viewsite" [title]="collapsed ? 'View Public Site' : ''">
            <span [innerHTML]="svg('globe', 16)"></span>
            <span *ngIf="!collapsed">View Public Site</span>
            <span class="n-tip" *ngIf="collapsed">View Site</span>
          </a>

          <div class="foot-user" *ngIf="user$ | async as user">
            <div class="avi">{{ getUserInitial(user) }}</div>
            <div class="foot-meta" *ngIf="!collapsed">
              <span class="foot-name">{{ getUserName(user) }}</span>
              <span class="foot-role">Administrator</span>
            </div>
            <button (click)="logout()" class="btn-lo-sm" title="Sign Out">
              <span [innerHTML]="svg('logout', 14)"></span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ══════════════════════════════════════════
           MOBILE SIDEBAR DRAWER (Slides from Left)
      ══════════════════════════════════════════ -->
      <div class="mob-backdrop" [class.vis]="mobileSidebarOpen" (click)="mobileSidebarOpen = false"></div>
      <aside class="mob-side-drawer" [class.open]="mobileSidebarOpen">
        <div class="mob-sd-hdr">
          <div class="brand-row">
            <img src="/logo-icon.png" alt="Net Mirror BDbd" class="admin-brand-icon" />
            <div class="brand-words">
              <span class="bw-name"><span class="bw-white">{{ brandFirst }}</span><span class="bw-red">{{ brandRest }}</span></span>
              <span class="bw-sub">Admin Navigation</span>
            </div>
          </div>
          <!-- Clear Collapse / Close Button in Mobile Sidebar -->
          <button class="btn-sd-collapse" (click)="mobileSidebarOpen = false" aria-label="Collapse sidebar">
            <span [innerHTML]="svg('chevronLeft', 18)"></span>
            <span class="collapse-lbl">Collapse</span>
          </button>
        </div>

        <div class="mob-sd-body">
          <ng-container *ngFor="let g of navGroups; let i = index">
            <div class="nav-grp-mob">{{ g.group }}</div>
            <div class="mob-nav-list">
              <a *ngFor="let item of g.items"
                 [routerLink]="item.path"
                 routerLinkActive="mob-active"
                 class="mob-nav-item"
                 (click)="closeDrawers()">
                <div class="mob-nav-icon" [style.background]="item.color + '1a'" [style.color]="item.color" [innerHTML]="svg(item.icon, 18)"></div>
                <span class="mob-nav-label">{{ item.label }}</span>
                <svg class="mob-nav-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
          </ng-container>
        </div>

        <div class="mob-sd-foot">
          <div class="foot-user-mob" *ngIf="user$ | async as user">
            <div class="avi lg">{{ getUserInitial(user) }}</div>
            <div class="foot-meta">
              <span class="foot-name">{{ getUserName(user) }}</span>
              <span class="foot-role">Administrator</span>
            </div>
            <button (click)="logout()" class="btn-sd-logout" title="Sign Out">
              <span [innerHTML]="svg('logout', 14)"></span>
            </button>
          </div>
          <a routerLink="/" class="btn-mob-viewsite" (click)="closeDrawers()">
            <span [innerHTML]="svg('globe', 16)"></span>
            <span>View Public Site</span>
          </a>
        </div>
      </aside>

      <!-- ══════════════════════════════════════════
           MAIN VIEW AREA
      ══════════════════════════════════════════ -->
      <div class="admin-main">

        <!-- Modern Topbar -->
        <header class="admin-topbar">
          <div class="tb-left">
            <!-- Sidebar toggle button: works on Desktop (collapse) AND Mobile (drawer) -->
            <button
              class="btn-tb-toggle"
              (click)="onTopbarSidebarClick()"
              [title]="'Toggle Sidebar (Ctrl+B)'"
              aria-label="Toggle sidebar">
              <span [innerHTML]="svg('panelLeft', 18)"></span>
            </button>

            <!-- Brand Logo for mobile topbar -->
            <div class="tb-mob-brand">
              <img src="/logo-icon.png" alt="Net Mirror BDbd" class="tb-brand-icon-img" />
              <span class="tb-brand-text"><span class="bw-white">{{ brandFirst }}</span><span class="bw-red">{{ brandRest }}</span></span>
            </div>

            <!-- Breadcrumbs pill -->
            <div class="tb-bc">
              <span class="tb-sec-chip">
                <span class="tb-sec-dot"></span>
                {{ currentSection }}
              </span>
            </div>
          </div>

          <div class="tb-right">
            <!-- Live traffic badge -->
            <div class="live-pill" title="Realtime server connection active">
              <span class="live-dot"></span>
              <span class="live-lbl">Live</span>
            </div>

            <!-- Mobile App Drawer button (Quick launch) -->
            <button class="btn-tb-apps" (click)="appDrawerOpen = true" title="Open Apps Drawer" aria-label="Open apps drawer">
              <span [innerHTML]="svg('apps', 18)"></span>
            </button>

            <!-- User Pill -->
            <div class="user-pill" *ngIf="user$ | async as user">
              <div class="pill-avi">{{ getUserInitial(user) }}</div>
              <span class="pill-nm">{{ getUserName(user) }}</span>
            </div>

            <!-- Sign Out -->
            <button (click)="logout()" class="btn-tb-lo" title="Sign Out">
              <span [innerHTML]="svg('logout', 15)"></span>
              <span class="lo-lbl">Sign Out</span>
            </button>
          </div>
        </header>

        <!-- Dynamic Admin Content -->
        <main class="admin-content">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- ══════════════════════════════════════════
           MOBILE BOTTOM APP TAB BAR
      ══════════════════════════════════════════ -->
      <nav class="mob-tabbar" aria-label="Mobile Navigation">
        <!-- 1. Dashboard -->
        <a routerLink="/admin/dashboard" routerLinkActive="tab-active" class="mob-tab" (click)="closeDrawers()">
          <span class="tab-ico" [innerHTML]="svg('grid', 20)"></span>
          <span class="tab-lbl">Home</span>
        </a>

        <!-- 2. Analytics -->
        <a routerLink="/admin/analytics" routerLinkActive="tab-active" class="mob-tab" (click)="closeDrawers()">
          <span class="tab-ico" [innerHTML]="svg('activity', 20)"></span>
          <span class="tab-lbl">Analytics</span>
        </a>

        <!-- 3. Sidebar Drawer Trigger (Allows opening the full side panel from bottom bar) -->
        <button class="mob-tab tab-btn" (click)="toggleMobileSidebar()" [class.tab-active]="mobileSidebarOpen">
          <span class="tab-ico" [innerHTML]="svg('sidebar', 20)"></span>
          <span class="tab-lbl">Sidebar</span>
        </button>

        <!-- 4. Users -->
        <a routerLink="/admin/users" routerLinkActive="tab-active" class="mob-tab" (click)="closeDrawers()">
          <span class="tab-ico" [innerHTML]="svg('users', 20)"></span>
          <span class="tab-lbl">Users</span>
        </a>

        <!-- 5. App Drawer (Bottom Sheet) -->
        <button class="mob-tab tab-btn" (click)="toggleAppDrawer()" [class.tab-active]="appDrawerOpen">
          <span class="tab-ico" [innerHTML]="svg('apps', 20)"></span>
          <span class="tab-lbl">Apps</span>
        </button>
      </nav>

      <!-- ══════════════════════════════════════════
           MOBILE BOTTOM APP DRAWER (Sheet)
      ══════════════════════════════════════════ -->
      <div class="mob-backdrop" [class.vis]="appDrawerOpen" (click)="appDrawerOpen = false"></div>
      <div class="mob-app-drawer" [class.open]="appDrawerOpen">

        <!-- Handle bar (tap to dismiss) -->
        <div class="drw-handle" (click)="appDrawerOpen = false"></div>

        <!-- Drawer Header -->
        <div class="drw-hdr">
          <div class="drw-brand">
            <img src="/logo-icon.png" alt="Net Mirror BDbd" class="admin-brand-icon sm" />
            <div>
              <div class="drw-title">{{ siteName }} Apps</div>
              <div class="drw-sub">Control Center &amp; Management</div>
            </div>
          </div>
          <button class="btn-drw-close" (click)="appDrawerOpen = false" aria-label="Close apps drawer">
            <span [innerHTML]="svg('x', 18)"></span>
          </button>
        </div>

        <!-- App Grid Content -->
        <div class="drw-scroll">
          <ng-container *ngFor="let g of navGroups">
            <div class="drw-grp-lbl">{{ g.group }}</div>
            <div class="drw-grid">
              <a *ngFor="let item of g.items"
                 [routerLink]="item.path"
                 routerLinkActive="drw-active"
                 class="drw-card"
                 (click)="closeDrawers()">
                <div class="drw-card-icon" [style.background]="item.color + '22'" [style.color]="item.color" [innerHTML]="svg(item.icon, 22)"></div>
                <span class="drw-card-title">{{ item.short }}</span>
                <span class="drw-card-sub">{{ item.label }}</span>
              </a>
            </div>
          </ng-container>
        </div>

        <!-- Drawer Footer -->
        <div class="drw-foot">
          <a routerLink="/" class="btn-drw-site" (click)="closeDrawers()">
            <span [innerHTML]="svg('globe', 16)"></span>
            <span>View Public Site</span>
          </a>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    *, *::before, *::after { box-sizing: border-box; }

    .admin-layout {
      display: flex; min-height: 100vh;
      background: #070a10; color: #f0f6fc;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      --sw: 260px;
      --sw-c: 68px;
      --th: 60px;
      --tab-h: 66px;
      --accent: #6366f1;
      --border: rgba(255, 255, 255, 0.07);
      --surface: rgba(255, 255, 255, 0.035);
    }

    /* ══════════════════════════════════════════════
       DESKTOP SIDEBAR
    ══════════════════════════════════════════════ */
    .desk-sidebar {
      width: var(--sw);
      background: #090c13;
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      flex-shrink: 0; position: sticky;
      top: 0; height: 100vh;
      overflow-y: auto; overflow-x: hidden;
      z-index: 200;
      transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      scrollbar-width: none;
    }
    .desk-sidebar::-webkit-scrollbar { display: none; }
    .desk-sidebar.collapsed { width: var(--sw-c); }

    @media (max-width: 960px) {
      .desk-sidebar { display: none !important; }
    }

    /* Sidebar Brand Header */
    .sidebar-brand {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1rem; border-bottom: 1px solid var(--border);
      min-height: var(--th); gap: 0.5rem; flex-shrink: 0;
      transition: all 0.2s;
    }
    .sidebar-brand.is-collapsed {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 0.4rem;
      gap: 0.6rem;
    }

    .admin-brand-icon {
      width: clamp(32px, 3.5vw, 38px);
      height: clamp(32px, 3.5vw, 38px);
      aspect-ratio: 1 / 1;
      object-fit: contain;
      flex-shrink: 0;
      filter: drop-shadow(0 0 10px rgba(229, 9, 20, 0.45));
    }
    .admin-brand-icon.sm {
      width: 28px;
      height: 28px;
    }
    .tb-brand-icon-img {
      width: 28px;
      height: 28px;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      flex-shrink: 0;
      filter: drop-shadow(0 0 8px rgba(229, 9, 20, 0.4));
    }

    .brand-words { display: flex; flex-direction: column; overflow: hidden; line-height: 1.2; }
    .bw-name { font-size: 1.08rem; font-weight: 800; color: #fff; white-space: nowrap; }
    .bw-white { color: #ffffff; }
    .bw-red {
      color: #e50914;
      background: linear-gradient(135deg, #ff2a33, #e50914);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .bw-g { background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .bw-sub { font-size: 0.62rem; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: .12em; }

    /* Collapse button in Desktop Sidebar */
    .btn-col {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: #94a3b8;
      width: 32px; height: 32px; border-radius: 8px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .btn-col:hover {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.4);
      color: #fff;
      transform: scale(1.04);
    }
    .btn-col:active { transform: scale(0.96); }

    /* Nav items */
    .sidebar-nav { padding: 0.6rem 0.55rem; display: flex; flex-direction: column; flex: 1; gap: 2px; }
    .nav-sep { height: 1px; background: var(--border); margin: 0.45rem 0.35rem; }
    .nav-grp {
      font-size: 0.6rem; font-weight: 700; color: #475569;
      letter-spacing: .12em; text-transform: uppercase;
      padding: 0.6rem 0.65rem 0.25rem; white-space: nowrap;
    }
    .nav-item {
      display: flex; align-items: center; gap: 0.7rem;
      padding: 0.55rem 0.75rem; border-radius: 10px;
      color: #94a3b8; text-decoration: none;
      font-size: 0.84rem; font-weight: 500;
      transition: all 0.16s ease; position: relative;
      white-space: nowrap; overflow: hidden;
    }
    .nav-item:hover { background: rgba(255, 255, 255, 0.06); color: #f1f5f9; }
    .nav-item.active {
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.22), rgba(168, 85, 247, 0.08));
      color: #e0e7ff; font-weight: 600;
      border: 1px solid rgba(99, 102, 241, 0.25);
    }
    .nav-item.active::before {
      content: ''; position: absolute;
      left: 0; top: 16%; bottom: 16%; width: 3px;
      border-radius: 0 4px 4px 0;
      background: linear-gradient(180deg, #6366f1, #a855f7);
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.8);
    }
    .n-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .nav-item.active .n-icon { color: #818cf8; }
    .n-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .nav-unread-badge {
      background: #10b981; color: white;
      font-size: 0.62rem; font-weight: 800;
      min-width: 18px; height: 18px; border-radius: 100px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px; flex-shrink: 0;
      animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes badgePop { from { transform: scale(0); } to { transform: scale(1); } }

    /* Tooltip on collapsed desktop sidebar */
    .n-tip {
      position: absolute; left: calc(100% + 12px); top: 50%; transform: translateY(-50%);
      background: #1e293b; color: #f8fafc; font-size: 0.78rem; font-weight: 600;
      padding: 0.35rem 0.75rem; border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.12); white-space: nowrap;
      pointer-events: none; opacity: 0; transition: opacity 0.16s ease, transform 0.16s ease;
      z-index: 500; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    .n-tip::before {
      content: ''; position: absolute; right: 100%; top: 50%; transform: translateY(-50%);
      border: 5px solid transparent; border-right-color: #1e293b;
    }
    .nav-item:hover .n-tip, .btn-viewsite:hover .n-tip { opacity: 1; }

    /* Sidebar footer */
    .sidebar-foot {
      padding: 0.75rem 0.65rem; border-top: 1px solid var(--border);
      flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem;
    }
    .btn-viewsite {
      display: flex; align-items: center; justify-content: center; gap: 0.55rem;
      width: 100%; padding: 0.6rem;
      background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.22);
      border-radius: 10px; color: #818cf8; text-decoration: none;
      font-size: 0.82rem; font-weight: 600; transition: all 0.2s;
      position: relative; white-space: nowrap;
    }
    .btn-viewsite:hover { background: rgba(99, 102, 241, 0.2); color: #c7d2fe; }
    .foot-user {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.5rem 0.55rem; background: var(--surface);
      border: 1px solid var(--border); border-radius: 11px; overflow: hidden;
    }
    .foot-meta { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .foot-name { font-size: 0.82rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .foot-role { font-size: 0.62rem; color: #6366f1; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .avi {
      width: 32px; height: 32px; border-radius: 9px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex; align-items: center; justify-content: center;
      font-size: .84rem; font-weight: 800; color: #fff; flex-shrink: 0;
    }
    .avi.lg { width: 42px; height: 42px; border-radius: 12px; font-size: 1.05rem; }
    .btn-lo-sm {
      background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.18);
      color: #f87171; width: 30px; height: 30px; border-radius: 8px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: all 0.2s;
    }
    .btn-lo-sm:hover { background: rgba(239, 68, 68, 0.22); color: #fca5a5; }

    /* ══════════════════════════════════════════════
       MAIN CONTENT AREA & MODERN TOPBAR
    ══════════════════════════════════════════════ */
    .admin-main {
      flex: 1; display: flex; flex-direction: column; min-width: 0;
      overflow-x: hidden;
    }
    @media (max-width: 960px) {
      .admin-main { padding-bottom: calc(var(--tab-h) + 1.2rem); }
    }

    .admin-topbar {
      height: var(--th);
      background: rgba(9, 12, 19, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 1.5rem; position: sticky; top: 0; z-index: 100;
      gap: 1rem; flex-shrink: 0;
    }
    @media (max-width: 960px) {
      .admin-topbar { padding: 0 1rem; }
    }

    .tb-left { display: flex; align-items: center; gap: 0.85rem; min-width: 0; }
    .btn-tb-toggle {
      background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border);
      color: #94a3b8; width: 38px; height: 38px; border-radius: 10px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .btn-tb-toggle:hover { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.35); color: #fff; }
    .btn-tb-toggle:active { transform: scale(0.95); }

    .tb-mob-brand {
      display: none; align-items: center; gap: 0.45rem; font-weight: 800; font-size: 1rem;
    }
    .tb-brand-icon {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex; align-items: center; justify-content: center; font-size: 0.78rem;
    }
    .tb-brand-text { color: #fff; }
    @media (max-width: 768px) {
      .tb-mob-brand { display: flex; }
    }

    .tb-bc { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .tb-sec-chip {
      display: inline-flex; align-items: center; gap: 0.45rem;
      background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.22);
      color: #c7d2fe; font-size: 0.78rem; font-weight: 600;
      padding: 0.28rem 0.75rem; border-radius: 20px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tb-sec-dot { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; }
    @media (max-width: 520px) {
      .tb-sec-chip { display: none; }
    }

    .tb-right { display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0; }
    .live-pill {
      display: flex; align-items: center; gap: 0.45rem;
      background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.22);
      padding: 0.25rem 0.65rem; border-radius: 20px;
    }
    @media (max-width: 600px) { .live-pill { display: none; } }
    .live-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
      animation: pulseLive 2.2s infinite ease-in-out;
    }
    @keyframes pulseLive {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.85); }
    }
    .live-lbl { font-size: 0.7rem; font-weight: 700; color: #22c55e; letter-spacing: 0.05em; text-transform: uppercase; }

    /* App drawer topbar button */
    .btn-tb-apps {
      display: none;
      background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border);
      color: #94a3b8; width: 36px; height: 36px; border-radius: 10px;
      cursor: pointer; align-items: center; justify-content: center; transition: all 0.2s;
    }
    .btn-tb-apps:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    @media (max-width: 960px) {
      .btn-tb-apps { display: flex; }
    }

    .user-pill {
      display: flex; align-items: center; gap: 0.5rem;
      background: var(--surface); border: 1px solid var(--border);
      padding: 0.28rem 0.75rem 0.28rem 0.36rem; border-radius: 20px;
      font-size: 0.8rem; color: #94a3b8; max-width: 170px;
    }
    @media (max-width: 680px) { .user-pill { display: none; } }
    .pill-avi {
      width: 24px; height: 24px; border-radius: 7px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex; align-items: center; justify-content: center;
      font-size: .68rem; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .pill-nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .btn-tb-lo {
      background: rgba(239, 68, 68, 0.08); color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 0.4rem 0.85rem; border-radius: 10px;
      font-size: 0.8rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; gap: 0.45rem; transition: all 0.2s;
    }
    .btn-tb-lo:hover { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    @media (max-width: 480px) {
      .lo-lbl { display: none; }
      .btn-tb-lo { padding: 0.4rem; width: 36px; height: 36px; justify-content: center; }
    }

    .admin-content {
      padding: 1.75rem 2rem; flex: 1; overflow-y: auto;
    }
    @media (max-width: 768px) { .admin-content { padding: 1.25rem 1rem; } }
    @media (max-width: 480px) { .admin-content { padding: 1rem 0.75rem; } }

    /* ══════════════════════════════════════════════
       MOBILE SIDEBAR DRAWER (Full Left Panel)
    ══════════════════════════════════════════════ */
    .mob-side-drawer {
      display: none;
      position: fixed; top: 0; bottom: 0; left: 0;
      width: min(84vw, 320px);
      background: #0a0d15;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 600;
      transform: translateX(-100%);
      transition: transform 0.32s cubic-bezier(0.33, 1, 0.68, 1);
      flex-direction: column;
      box-shadow: 16px 0 48px rgba(0, 0, 0, 0.7);
    }
    @media (max-width: 960px) {
      .mob-side-drawer { display: flex; }
    }
    .mob-side-drawer.open { transform: translateX(0); }

    .mob-sd-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.15rem; border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
      min-height: var(--th); flex-shrink: 0;
    }
    .btn-sd-collapse {
      display: inline-flex; align-items: center; gap: 0.3rem;
      background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8; padding: 0.36rem 0.65rem; border-radius: 8px;
      font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-sd-collapse:hover { background: rgba(99, 102, 241, 0.2); color: #fff; }
    .collapse-lbl { line-height: 1; }

    .mob-sd-body {
      flex: 1; overflow-y: auto; padding: 0.75rem 0.85rem;
      scrollbar-width: thin;
    }
    .nav-grp-mob {
      font-size: 0.62rem; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: 0.12em;
      padding: 0.85rem 0.5rem 0.35rem;
    }
    .mob-nav-list { display: flex; flex-direction: column; gap: 3px; margin-bottom: 0.5rem; }
    .mob-nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.65rem 0.75rem; border-radius: 12px;
      background: rgba(255, 255, 255, 0.02); border: 1px solid transparent;
      color: #cbd5e1; text-decoration: none; font-size: 0.86rem; font-weight: 500;
      transition: all 0.18s;
    }
    .mob-nav-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
    .mob-nav-item.mob-active {
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.08));
      border-color: rgba(99, 102, 241, 0.3);
      color: #e0e7ff; font-weight: 600;
    }
    .mob-nav-icon {
      width: 32px; height: 32px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .mob-nav-label { flex: 1; }
    .mob-nav-arrow { color: #475569; transition: transform 0.2s; }
    .mob-nav-item.mob-active .mob-nav-arrow { color: #818cf8; transform: translateX(2px); }

    .mob-sd-foot {
      padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.25);
      display: flex; flex-direction: column; gap: 0.65rem; flex-shrink: 0;
    }
    .foot-user-mob {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.6rem 0.75rem; background: var(--surface);
      border: 1px solid var(--border); border-radius: 12px;
    }
    .btn-sd-logout {
      background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
      color: #f87171; width: 34px; height: 34px; border-radius: 9px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: all 0.2s;
    }
    .btn-sd-logout:hover { background: rgba(239, 68, 68, 0.22); color: #fca5a5; }
    .btn-mob-viewsite {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      width: 100%; padding: 0.65rem;
      background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 11px; color: #818cf8; text-decoration: none;
      font-size: 0.84rem; font-weight: 600; transition: all 0.2s;
    }

    /* ══════════════════════════════════════════════
       MOBILE BOTTOM APP TAB BAR
    ══════════════════════════════════════════════ */
    .mob-tabbar {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0;
      height: var(--tab-h);
      background: rgba(9, 12, 19, 0.94);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 450;
      padding: 0 0.5rem max(0.35rem, env(safe-area-inset-bottom));
      align-items: stretch; justify-content: space-around;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
    @media (max-width: 960px) {
      .mob-tabbar { display: flex; }
    }
    .mob-tab {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0.25rem;
      color: #64748b; text-decoration: none;
      font-size: 0.68rem; font-weight: 600;
      padding: 0.4rem 0.5rem; flex: 1;
      border: none; background: none; cursor: pointer;
      transition: color 0.18s, transform 0.15s; position: relative;
      font-family: inherit;
    }
    .mob-tab:active { transform: scale(0.92); }
    .mob-tab.tab-active, .mob-tab:hover { color: #818cf8; }
    .mob-tab.tab-active::after {
      content: ''; position: absolute;
      top: 0; left: 24%; right: 24%; height: 3px;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 0 0 4px 4px;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.8);
    }
    .tab-ico { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
    .tab-lbl { line-height: 1; letter-spacing: -0.01em; }

    /* ══════════════════════════════════════════════
       MOBILE BOTTOM APP DRAWER (Sheet)
    ══════════════════════════════════════════ */
    .mob-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 550; opacity: 0; pointer-events: none;
      transition: opacity 0.3s ease;
    }
    @media (max-width: 960px) {
      .mob-backdrop { display: block; }
      .mob-backdrop.vis { opacity: 1; pointer-events: all; }
    }

    .mob-app-drawer {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #0d111a;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px 24px 0 0;
      z-index: 580;
      transform: translateY(100%);
      transition: transform 0.36s cubic-bezier(0.33, 1, 0.68, 1);
      max-height: 86vh;
      flex-direction: column;
      box-shadow: 0 -24px 64px rgba(0, 0, 0, 0.7);
    }
    @media (max-width: 960px) {
      .mob-app-drawer { display: flex; }
    }
    .mob-app-drawer.open { transform: translateY(0); }

    .drw-handle {
      width: 42px; height: 5px;
      background: rgba(255, 255, 255, 0.2); border-radius: 3px;
      margin: 0.75rem auto 0.25rem; cursor: pointer; flex-shrink: 0;
    }
    .drw-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1.25rem 0.5rem; flex-shrink: 0;
    }
    .drw-brand { display: flex; align-items: center; gap: 0.75rem; }
    .drw-title { font-size: 1rem; font-weight: 800; color: #fff; line-height: 1.2; }
    .drw-sub { font-size: 0.68rem; color: #94a3b8; }
    .btn-drw-close {
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8; width: 32px; height: 32px; border-radius: 9px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .btn-drw-close:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }

    .drw-scroll {
      flex: 1; overflow-y: auto; padding: 0.25rem 1.15rem 0.5rem;
      scrollbar-width: thin;
    }
    .drw-grp-lbl {
      font-size: 0.62rem; font-weight: 700; color: #475569;
      text-transform: uppercase; letter-spacing: .12em;
      padding: 0.75rem 0.25rem 0.4rem;
    }
    .drw-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 0.55rem; margin-bottom: 0.35rem;
    }
    @media (max-width: 440px) {
      .drw-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 320px) {
      .drw-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .drw-card {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 0.4rem;
      padding: 0.85rem 0.45rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #cbd5e1; text-decoration: none;
      text-align: center; transition: all 0.2s ease;
    }
    .drw-card:hover {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.3);
      color: #fff; transform: translateY(-2px);
    }
    .drw-card:active { transform: scale(0.96); }
    .drw-card.drw-active {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.14));
      border-color: rgba(99, 102, 241, 0.45);
      color: #e0e7ff;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.2);
    }
    .drw-card-icon {
      width: 40px; height: 40px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    .drw-card:hover .drw-card-icon { transform: scale(1.08); }
    .drw-card-title { font-size: 0.78rem; font-weight: 700; line-height: 1.1; }
    .drw-card-sub { font-size: 0.62rem; color: #64748b; line-height: 1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .drw-foot {
      padding: 0.85rem 1.15rem calc(0.85rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--border); flex-shrink: 0;
      background: rgba(0, 0, 0, 0.2);
    }
    .btn-drw-site {
      display: flex; align-items: center; justify-content: center; gap: 0.55rem;
      width: 100%; padding: 0.75rem;
      background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 12px; color: #818cf8;
      text-decoration: none; font-size: 0.88rem; font-weight: 600; transition: all 0.2s;
    }
    .btn-drw-site:hover { background: rgba(99, 102, 241, 0.22); color: #c7d2fe; }
  `]
})
export class AdminShellComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly iconCache = new Map<string, SafeHtml>();
  private sub?: Subscription;
  private routerSub?: Subscription;

  readonly chatUnread$ = this.chatService.adminUnreadCount$;

  readonly navGroups = NAV_GROUPS;

  collapsed = false;
  mobileSidebarOpen = false;
  appDrawerOpen = false;

  user$ = this.auth.currentUser$;
  siteName = 'Net Mirror BD';
  brandFirst = 'Stream';
  brandRest = 'Flix';
  currentSection = 'Dashboard';

  private readonly sectionMap: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Analytics & Traffic',
    visitors: 'Visitor Logs',
    movies: 'Movies & Import',
    tv: 'TV Series',
    genres: 'Genres & Tags',
    servers: 'Streaming Servers',
    users: 'Users & Accounts',
    reviews: 'Reviews Moderation',
    roles: 'Roles & Permissions',
    settings: 'Site Settings',
    seo: 'SEO & Metadata',
    ads: 'Advertisements',
    notifications: 'Push Notifications',
    logs: 'System Logs',
  };

  svg(icon: string, size = 18): SafeHtml {
    const key = `${icon}_${size}`;
    let res = this.iconCache.get(key);
    if (!res) {
      const raw = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">${ICONS[icon] ?? ''}</svg>`;
      res = this.sanitizer.bypassSecurityTrustHtml(raw);
      this.iconCache.set(key, res);
    }
    return res;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Ctrl+B or Cmd+B to toggle sidebar collapse
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.toggleCollapse();
    }
  }

  ngOnInit(): void {
    this.collapsed = localStorage.getItem('admin_sidebar_collapsed') === 'true';
    this.sub = this.settingsService.settings$.subscribe(s => {
      const name = s.siteName || 'Net Mirror BDbd';
      this.siteName = name;
      if (name.toLowerCase().startsWith('Net Mirror BD')) {
        this.brandFirst = 'Net Mirror BD';
        this.brandRest = name.slice(10) || 'bd';
      } else if (name.toLowerCase().startsWith('stream')) {
        this.brandFirst = 'Stream';
        this.brandRest = name.slice(6);
      } else {
        const h = Math.ceil(name.length / 2);
        this.brandFirst = name.slice(0, h);
        this.brandRest = name.slice(h);
      }
    });

    this.updateSection(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.updateSection(e.urlAfterRedirects);
      this.closeDrawers();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  toggleCollapse(): void {
    if (window.innerWidth <= 960) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
    } else {
      this.collapsed = !this.collapsed;
      localStorage.setItem('admin_sidebar_collapsed', String(this.collapsed));
    }
  }

  onTopbarSidebarClick(): void {
    if (window.innerWidth <= 960) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
    } else {
      this.collapsed = !this.collapsed;
      localStorage.setItem('admin_sidebar_collapsed', String(this.collapsed));
    }
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
    if (this.mobileSidebarOpen) {
      this.appDrawerOpen = false;
    }
  }

  toggleAppDrawer(): void {
    this.appDrawerOpen = !this.appDrawerOpen;
    if (this.appDrawerOpen) {
      this.mobileSidebarOpen = false;
    }
  }

  closeDrawers(): void {
    this.mobileSidebarOpen = false;
    this.appDrawerOpen = false;
  }

  private updateSection(url: string): void {
    const seg = url.split('?')[0].split('/').filter(Boolean).pop() || '';
    this.currentSection = this.sectionMap[seg] ?? 'Control Center';
  }

  getUserName(user: any): string {
    return user.displayName || user.email?.split('@')[0] || 'Admin';
  }

  getUserInitial(user: any): string {
    return (user.displayName || user.email || 'A').charAt(0).toUpperCase();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/']);
  }
}

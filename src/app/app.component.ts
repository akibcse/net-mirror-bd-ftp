import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { VisitorLogService } from './services/visitor-log.service';
import { UserActivityService } from './services/user-activity.service';
import { SettingsService } from './services/settings.service';
import { AppUser } from './models/user.model';
import { VisitorAdModalComponent } from './shared/components/visitor-ad-modal.component';
import { LiveChatWidgetComponent } from './shared/components/live-chat-widget.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, VisitorAdModalComponent, LiveChatWidgetComponent],
  template: `
    <!-- TOP ANNOUNCEMENT BANNER -->
    <aside
      class="announcement-bar"
      *ngIf="!isAdminRoute() && !announcementDismissed() && (settings$ | async)?.announcement?.enabled && (settings$ | async)?.announcement?.message as msg"
      aria-label="Site announcement"
    >
      <div class="announcement-inner">
        <span class="announcement-badge">ANNOUNCEMENT</span>
        <p class="announcement-text">{{ msg }}</p>
        <button
          type="button"
          class="btn-dismiss-announcement"
          (click)="announcementDismissed.set(true)"
          title="Dismiss announcement"
        >
          ✕
        </button>
      </div>
    </aside>

    <!-- HEADER / NAVIGATION -->
    <header class="app-nav" *ngIf="!isAdminRoute()">
      <div class="nav-container">
        <div class="nav-left">
          <a routerLink="/" class="brand-logo" *ngIf="settings$ | async as s" title="Net Mirror BD">
            <img src="/logo-icon.png" alt="Net Mirror BD Logo" class="brand-logo-img" />
            <span class="brand-text-wrap">
              <span class="brand-text-white">{{ getBrandFirst(s.siteName) }}</span><span class="brand-text-red">{{ getBrandRest(s.siteName) }}</span>
            </span>
          </a>

          <nav class="nav-links">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">
              Home
            </a>
            <a routerLink="/movies" routerLinkActive="active" class="nav-link">
              Movies
            </a>
            <a routerLink="/tv" routerLinkActive="active" class="nav-link">
              TV Series
            </a>
            <a routerLink="/search" routerLinkActive="active" class="nav-link">
              🔍 Search
            </a>
            <a routerLink="/my-list" routerLinkActive="active" class="nav-link">
              📑 My List
            </a>
          </nav>
        </div>

        <div class="nav-right">
          <ng-container *ngIf="currentUser$ | async as user; else guestTpl">
            <div class="user-profile-menu">
              <!-- Admin quick badge (desktop & mobile header) -->
              <a *ngIf="(isAdmin$ | async) || user.role === 'admin'" routerLink="/admin" class="admin-chip" title="Admin Portal">
                🛡️ Admin Panel
              </a>

              <!-- Notifications -->
              <a routerLink="/notifications" class="btn-notif" title="Notifications">
                🔔
              </a>

              <!-- Interactive User Menu with Popover -->
              <div class="user-dropdown-wrapper">
                <button class="user-profile-btn" (click)="toggleUserMenu($event)" title="User Account Menu" type="button">
                  <div class="user-avatar">
                    {{ getUserInitial(user) }}
                  </div>
                  <span class="user-name">{{ getUserName(user) }}</span>
                  <span class="dropdown-chevron" [class.open]="userMenuOpen">▾</span>
                </button>

                <!-- Floating Dropdown Menu -->
                <div class="user-dropdown-popover" *ngIf="userMenuOpen" (click)="$event.stopPropagation()">
                  <div class="popover-user-card">
                    <div class="popover-avatar">{{ getUserInitial(user) }}</div>
                    <div class="popover-meta">
                      <div class="popover-name">{{ getUserName(user) }}</div>
                      <div class="popover-email">{{ user.email || user.phoneNumber || '' }}</div>
                      <span class="popover-role-tag" [class.admin]="(isAdmin$ | async) || user.role === 'admin'">
                        {{ ((isAdmin$ | async) || user.role === 'admin') ? '🛡️ Administrator' : '👤 Member' }}
                      </span>
                    </div>
                  </div>

                  <div class="popover-divider"></div>

                  <a *ngIf="(isAdmin$ | async) || user.role === 'admin'" routerLink="/admin" (click)="userMenuOpen = false" class="popover-link popover-admin-highlight">
                    <span class="popover-icon">🛡️</span>
                    <div class="popover-link-text">
                      <span class="plt-main">Admin Dashboard</span>
                      <span class="plt-desc">Manage site, users & media</span>
                    </div>
                  </a>

                  <a routerLink="/profile" (click)="userMenuOpen = false" class="popover-link">
                    <span class="popover-icon">👤</span>
                    <div class="popover-link-text">
                      <span class="plt-main">My Profile</span>
                      <span class="plt-desc">Account & settings</span>
                    </div>
                  </a>

                  <a routerLink="/my-list" (click)="userMenuOpen = false" class="popover-link">
                    <span class="popover-icon">📑</span>
                    <div class="popover-link-text">
                      <span class="plt-main">My Watchlist</span>
                      <span class="plt-desc">Saved movies & series</span>
                    </div>
                  </a>

                  <a routerLink="/notifications" (click)="userMenuOpen = false" class="popover-link">
                    <span class="popover-icon">🔔</span>
                    <div class="popover-link-text">
                      <span class="plt-main">Notifications</span>
                      <span class="plt-desc">Updates & announcements</span>
                    </div>
                  </a>

                  <div class="popover-divider"></div>

                  <button (click)="logout(); userMenuOpen = false" class="popover-link popover-logout" type="button">
                    <span class="popover-icon">🚪</span>
                    <div class="popover-link-text">
                      <span class="plt-main">Sign Out</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </ng-container>

          <ng-template #guestTpl>
            <div class="guest-actions">
              <a routerLink="/login" class="btn-signin">Sign In</a>
              <a routerLink="/register" class="btn-signup">Sign Up</a>
            </div>
          </ng-template>

          <!-- Mobile Hamburger -->
          <button class="btn-hamburger" (click)="mobileNavOpen = !mobileNavOpen" aria-label="Open menu">
            <svg *ngIf="!mobileNavOpen" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <svg *ngIf="mobileNavOpen" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- MOBILE DROPDOWN NAV -->
      <div class="mobile-nav-drawer" [class.open]="mobileNavOpen" (click)="mobileNavOpen = false">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="mob-link">🏠 Home</a>
        <a routerLink="/movies" routerLinkActive="active" class="mob-link">🎬 Movies</a>
        <a routerLink="/tv" routerLinkActive="active" class="mob-link">📺 TV Series</a>
        <a routerLink="/search" routerLinkActive="active" class="mob-link">🔍 Search</a>
        <a routerLink="/my-list" routerLinkActive="active" class="mob-link">📑 My List</a>

        <ng-container *ngIf="currentUser$ | async as user">
          <div class="mob-divider"></div>
          <div class="mob-user-card">
            <div class="mob-user-avatar">{{ getUserInitial(user) }}</div>
            <div class="mob-user-info">
              <div class="mob-user-name">{{ getUserName(user) }}</div>
              <div class="mob-user-email">{{ user.email || user.phoneNumber }}</div>
              <span class="mob-user-badge" [class.admin]="(isAdmin$ | async) || user.role === 'admin'">
                {{ ((isAdmin$ | async) || user.role === 'admin') ? '🛡️ Administrator' : '👤 Member' }}
              </span>
            </div>
          </div>
          <a *ngIf="(isAdmin$ | async) || user.role === 'admin'" routerLink="/admin" routerLinkActive="active" class="mob-link mob-admin">
            🛡️ Admin Panel
          </a>
          <a routerLink="/profile" routerLinkActive="active" class="mob-link">👤 My Profile</a>
          <a routerLink="/notifications" routerLinkActive="active" class="mob-link">🔔 Notifications</a>
          <div class="mob-divider"></div>
          <button (click)="logout()" class="mob-link mob-logout">🚪 Sign Out</button>
        </ng-container>

        <ng-container *ngIf="!(currentUser$ | async)">
          <div class="mob-divider"></div>
          <a routerLink="/login" class="mob-link mob-signin">Sign In</a>
          <a routerLink="/register" class="mob-link mob-signup">Sign Up Free</a>
        </ng-container>
      </div>
    </header>

    <!-- MAINTENANCE MODE OVERLAY (Blocks regular viewers when active) -->
    <div
      class="maintenance-overlay"
      *ngIf="(settings$ | async)?.maintenanceMode && (isAdmin$ | async) === false"
    >
      <div class="maintenance-box">
        <div class="maintenance-icon">🚧</div>
        <h2>Site Under Scheduled Maintenance</h2>
        <p>Our platform is temporarily offline while we perform scheduled infrastructure enhancements. We will be back online shortly!</p>
        <div class="maintenance-actions">
          <a routerLink="/login" class="btn-admin-gate">Administrator Sign In</a>
        </div>
      </div>
    </div>

    <!-- MAIN PAGE BODY -->
    <main class="page-body" [class.admin-mode]="isAdminRoute()" *ngIf="!(settings$ | async)?.maintenanceMode || (isAdmin$ | async)">
      <router-outlet></router-outlet>
    </main>

    <!-- FOOTER -->
    <footer class="app-footer" *ngIf="!isAdminRoute() && (!(settings$ | async)?.maintenanceMode || (isAdmin$ | async))">
      <div class="footer-container">
        <div class="footer-brand-col" *ngIf="settings$ | async as s">
          <a routerLink="/" class="footer-logo" title="Net Mirror BD">
            <img src="/logo-icon.png" alt="Net Mirror BD Logo" class="footer-logo-img" />
            <span class="brand-text-wrap">
              <span class="brand-text-white">{{ getBrandFirst(s.siteName) }}</span><span class="brand-text-red">{{ getBrandRest(s.siteName) }}</span>
            </span>
          </a>
          <div class="brand-tagline">MOVIES ANYTIME EVERYWHERE</div>
          <p class="footer-desc">
            {{ s.footerText || 'The premier free streaming destination for full HD movies and television series. Multiple high-speed servers, no subscription fees.' }}
          </p>
          <div class="creator-card">
            <span class="creator-label">Lead Developer & Architect:</span>
            <span class="creator-name">Md. Akib Hasan</span>
            <a href="mailto:roadyakib@gmail.com" class="creator-email">✉️ roadyakib&#64;gmail.com</a>
          </div>
        </div>

        <div class="footer-links-col">
          <h4>Navigation</h4>
          <a routerLink="/">Home</a>
          <a routerLink="/movies">Browse Movies</a>
          <a routerLink="/tv">TV Shows</a>
          <a routerLink="/search">Search Catalog</a>
          <a routerLink="/my-list">My Library</a>
        </div>

        <div class="footer-links-col">
          <h4>Popular Genres</h4>
          <a [routerLink]="['/genre', 'movie', 28, 'Action']">Action Movies</a>
          <a [routerLink]="['/genre', 'movie', 35, 'Comedy']">Comedy Movies</a>
          <a [routerLink]="['/genre', 'movie', 878, 'Sci-Fi']">Sci-Fi Cinema</a>
          <a [routerLink]="['/genre', 'movie', 27, 'Horror']">Horror Films</a>
          <a [routerLink]="['/genre', 'tv', 18, 'Drama']">Drama TV Shows</a>
        </div>

        <div class="footer-links-col">
          <h4>Account & Support</h4>
          <a routerLink="/profile">User Profile</a>
          <a routerLink="/notifications">Announcements</a>
          <a routerLink="/login">Sign In / Register</a>
        </div>
      </div>

      <div class="footer-bottom" *ngIf="settings$ | async as s">
        <p class="credit-highlight">
          Designed & Developed with ❤️ by <strong class="author-name">Md. Akib Hasan</strong>
          • Contact: <a href="mailto:roadyakib@gmail.com" class="author-email-link">roadyakib&#64;gmail.com</a>
        </p>
        <p class="copyright-line">© 2026 {{ s.siteName || 'Net Mirror BD' }}. All rights reserved.</p>
      </div>
    </footer>

    <!-- MOBILE BOTTOM NAVIGATION BAR -->
    <nav class="mobile-bottom-nav" *ngIf="!isAdminRoute()">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="mobile-tab">
        <span class="tab-icon">🏠</span>
        <span class="tab-text">Home</span>
      </a>
      <a routerLink="/movies" routerLinkActive="active" class="mobile-tab">
        <span class="tab-icon">🎬</span>
        <span class="tab-text">Movies</span>
      </a>
      <a routerLink="/tv" routerLinkActive="active" class="mobile-tab">
        <span class="tab-icon">📺</span>
        <span class="tab-text">Series</span>
      </a>
      <a *ngIf="(isAdmin$ | async)" routerLink="/admin" routerLinkActive="active" class="mobile-tab tab-admin">
        <span class="tab-icon">🛡️</span>
        <span class="tab-text">Admin</span>
      </a>
      <a *ngIf="!(isAdmin$ | async)" routerLink="/my-list" routerLinkActive="active" class="mobile-tab">
        <span class="tab-icon">📑</span>
        <span class="tab-text">My List</span>
      </a>
      <a *ngIf="currentUser$ | async" routerLink="/profile" routerLinkActive="active" class="mobile-tab">
        <span class="tab-icon">👤</span>
        <span class="tab-text">Profile</span>
      </a>
      <a *ngIf="!(currentUser$ | async)" routerLink="/login" routerLinkActive="active" class="mobile-tab">
        <span class="tab-icon">🔑</span>
        <span class="tab-text">Sign In</span>
      </a>
    </nav>

    <!-- 30-SECOND VISITOR AD MODAL (Triggered by movie card clicks, once in 24h per device) -->
    <app-visitor-ad-modal *ngIf="!isAdminRoute()"></app-visitor-ad-modal>

    <!-- LIVE CHAT WIDGET (Bottom-right floating bubble for all pages except admin) -->
    <app-live-chat-widget *ngIf="!isAdminRoute()"></app-live-chat-widget>
  `,
  styles: [`
    :host {
      display: block;
      background-color: #0b0e14;
      min-height: 100vh;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Announcement Bar */
    .announcement-bar {
      background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%);
      color: #ffffff;
      padding: 0.65rem 1.5rem;
      position: sticky;
      top: 0;
      z-index: 101;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }

    .announcement-inner {
      max-width: 1500px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .announcement-badge {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 2px 8px;
      border-radius: 6px;
      white-space: nowrap;
    }

    .announcement-text {
      font-size: 0.88rem;
      font-weight: 600;
      margin: 0;
      flex: 1;
      text-align: center;
    }

    .btn-dismiss-announcement {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #ffffff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      transition: background 0.2s;
    }

    .btn-dismiss-announcement:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .app-nav {
      background: rgba(11, 14, 20, 0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .nav-container {
      max-width: 1500px;
      margin: 0 auto;
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }

    .nav-left {
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: clamp(0.45rem, 1vw, 0.75rem);
      text-decoration: none;
      transition: transform 0.2s ease;
    }

    .brand-logo:hover {
      transform: scale(1.02);
    }

    .brand-logo-img {
      height: clamp(32px, 3.8vw, 42px);
      width: auto;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      filter: drop-shadow(0 0 12px rgba(229, 9, 20, 0.45));
      transition: all 0.25s ease;
    }

    .brand-logo:hover .brand-logo-img {
      filter: drop-shadow(0 0 18px rgba(229, 9, 20, 0.7));
    }

    .brand-text-wrap {
      display: inline-flex;
      align-items: baseline;
      font-size: clamp(1.3rem, 2.6vw, 1.75rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .brand-text-white {
      color: #ffffff;
    }

    .brand-text-red {
      color: #e50914;
      background: linear-gradient(135deg, #ff2a33, #e50914);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-gradient {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .nav-link {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 500;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .nav-link:hover, .nav-link.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.06);
    }




    .nav-right {
      display: flex;
      align-items: center;
    }

    .guest-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .btn-signin {
      color: #cbd5e1;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.45rem 1rem;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .btn-signin:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.06);
    }

    .btn-signup {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.45rem 1.1rem;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .btn-signup:hover {
      opacity: 0.95;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
    }

    .user-profile-menu {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .admin-chip {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .admin-chip:hover {
      background: rgba(245, 158, 11, 0.25);
      border-color: #fbbf24;
      transform: translateY(-1px);
    }

    .user-dropdown-wrapper {
      position: relative;
    }

    .user-profile-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      padding: 0.25rem 0.65rem 0.25rem 0.25rem;
      cursor: pointer;
      color: #f1f5f9;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .user-profile-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .dropdown-chevron {
      font-size: 0.75rem;
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .dropdown-chevron.open {
      transform: rotate(180deg);
    }

    .user-dropdown-popover {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 260px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 1100;
      padding: 0.5rem;
      backdrop-filter: blur(16px);
      animation: popoverFadeIn 0.18s ease-out;
    }

    @keyframes popoverFadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .popover-user-card {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.6rem 0.5rem;
    }

    .popover-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1rem;
      color: #fff;
      flex-shrink: 0;
    }

    .popover-meta {
      flex: 1;
      min-width: 0;
    }

    .popover-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .popover-email {
      font-size: 0.75rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .popover-role-tag {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      margin-top: 0.2rem;
      text-transform: uppercase;
    }

    .popover-role-tag.admin {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .popover-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 0.35rem 0;
    }

    .popover-link {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      text-decoration: none;
      color: #cbd5e1;
      font-family: inherit;
      width: 100%;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
    }

    .popover-link:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    .popover-admin-highlight {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }

    .popover-admin-highlight:hover {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
    }

    .popover-icon {
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .popover-link-text {
      display: flex;
      flex-direction: column;
    }

    .plt-main {
      font-size: 0.85rem;
      font-weight: 500;
      line-height: 1.2;
    }

    .plt-desc {
      font-size: 0.7rem;
      color: #64748b;
    }

    .popover-logout {
      color: #f87171;
    }

    .popover-logout:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #fca5a5;
    }

    .mob-user-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      margin: 0.25rem 0 0.5rem;
    }

    .mob-user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .mob-user-info {
      flex: 1;
      min-width: 0;
    }

    .mob-user-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mob-user-email {
      font-size: 0.75rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mob-user-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      margin-top: 0.2rem;
    }

    .mob-user-badge.admin {
      background: rgba(245, 158, 11, 0.18);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .tab-admin {
      color: #fbbf24 !important;
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 700;
      color: #ffffff;
      flex-shrink: 0;
    }

    .user-name {
      color: #f1f5f9;
      font-size: 0.9rem;
      font-weight: 500;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-logout {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-logout:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .btn-notif {
      text-decoration: none;
      font-size: 1.15rem;
      padding: 0.35rem;
      transition: transform 0.2s;
    }
    .btn-notif:hover { transform: scale(1.15); }

    .user-profile-link {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .user-profile-link:hover { opacity: 0.85; }

    .page-body {
      min-height: calc(100vh - 75px);
    }

    /* Maintenance Overlay */
    .maintenance-overlay {
      position: fixed;
      inset: 0;
      background: #090d16;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .maintenance-box {
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 3rem 2rem;
      max-width: 520px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .maintenance-icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .maintenance-box h2 { font-size: 1.8rem; color: #ffffff; margin-bottom: 0.75rem; }
    .maintenance-box p { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 1.75rem; }
    .btn-admin-gate {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      display: inline-block;
      transition: opacity 0.2s;
    }
    .btn-admin-gate:hover { opacity: 0.9; }

    /* App Footer */
    .app-footer {
      background: #070a0e;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding: 4rem 1.5rem 2rem;
      margin-top: 4rem;
    }

    .footer-container {
      max-width: 1440px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 3rem;
    }

    @media (max-width: 900px) {
      .footer-container { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) {
      .footer-container { grid-template-columns: 1fr; }
    }

    .footer-brand-col {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .footer-logo {
      display: inline-flex;
      align-items: center;
      gap: clamp(0.5rem, 1.2vw, 0.85rem);
      text-decoration: none;
    }

    .footer-logo-img {
      height: clamp(40px, 4.8vw, 54px);
      width: auto;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      filter: drop-shadow(0 0 14px rgba(229, 9, 20, 0.5));
    }

    .footer-logo .brand-text-wrap {
      font-size: clamp(1.5rem, 3vw, 2rem);
    }

    .brand-tagline {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      color: #94a3b8;
      text-transform: uppercase;
      margin-top: -0.25rem;
    }

    .footer-desc {
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.6;
      max-width: 380px;
      margin: 0;
    }

    .tmdb-attr {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #64748b;
    }

    .tmdb-text {
      background: linear-gradient(135deg, #01b4e4, #90cea1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 800;
    }

    .footer-links-col {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .footer-links-col h4 {
      font-size: 0.95rem;
      color: #ffffff;
      margin: 0 0 0.5rem;
      font-weight: 700;
    }

    .footer-links-col a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.2s;
    }

    .footer-links-col a:hover {
      color: #a855f7;
    }

    .creator-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-width: 340px;
    }
    .creator-label {
      font-size: 0.72rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .creator-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .creator-email {
      font-size: 0.8rem;
      color: #a5b4fc;
      text-decoration: none;
      transition: color 0.2s;
    }
    .creator-email:hover {
      color: #ffffff;
      text-decoration: underline;
    }
    .footer-bottom {
      max-width: 1440px;
      margin: 3rem auto 0;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      text-align: center;
      color: #64748b;
      font-size: 0.8rem;
    }
    .credit-highlight {
      color: #cbd5e1;
      font-size: 0.88rem;
      margin: 0 0 0.5rem;
    }
    .author-name {
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 800;
    }
    .author-email-link {
      color: #a5b4fc;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    .author-email-link:hover {
      color: #ffffff;
      text-decoration: underline;
    }
    .copyright-line {
      margin: 0;
      color: #64748b;
      font-size: 0.78rem;
    }

    /* Mobile Bottom Nav */
    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(11, 14, 20, 0.96);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 1000;
      padding: 0.5rem 0.25rem max(0.5rem, env(safe-area-inset-bottom));
      justify-content: space-around;
      align-items: center;
    }

    .mobile-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.72rem;
      font-weight: 500;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      transition: color 0.2s;
    }

    .mobile-tab .tab-icon {
      font-size: 1.25rem;
    }

    .mobile-tab.active {
      color: #818cf8;
    }

    /* Mobile Hamburger */
    .btn-hamburger {
      display: none;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .btn-hamburger:hover { background: rgba(255,255,255,0.1); color: white; }

    /* Mobile Drawer */
    .mobile-nav-drawer {
      display: none;
      flex-direction: column;
      background: rgba(9, 12, 18, 0.98);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 0;
      gap: 0.25rem;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), padding 0.35s;
    }
    .mobile-nav-drawer.open {
      display: flex;
      max-height: 600px;
      padding: 0.75rem 1rem 1.25rem;
    }
    .mob-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.15s;
    }
    .mob-link:hover, .mob-link.active { background: rgba(255,255,255,0.06); color: #fff; }
    .mob-admin { color: #fbbf24; }
    .mob-admin:hover, .mob-admin.active { background: rgba(245,158,11,0.1); color: #fbbf24; }
    .mob-signin {
      margin-top: 0.5rem;
      text-align: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.12);
      color: #e2e8f0;
    }
    .mob-signup {
      text-align: center;
      justify-content: center;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: #fff;
      font-weight: 600;
    }
    .mob-signup:hover { opacity: 0.9; }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .btn-hamburger { display: flex; }
      .mobile-bottom-nav { display: flex; }
      .page-body { padding-bottom: 70px; }
      .page-body.admin-mode { padding-bottom: 0 !important; }
      .user-name { display: none; }
      .dropdown-chevron { display: none; }
      .btn-logout { display: none; }
      .guest-actions { display: none; }
      /* Keep admin chip visible on mobile */
      .admin-chip { display: inline-flex; font-size: 0.68rem; padding: 0.2rem 0.5rem; }
      .btn-notif { display: none; }
      .nav-right { gap: 0.5rem; }
    }
    /* Mobile drawer helpers */
    .mob-divider {
      height: 1px;
      background: rgba(255,255,255,0.07);
      margin: 0.25rem 0;
    }
    .mob-logout {
      background: none;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      color: #f87171;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .mob-logout:hover { background: rgba(239,68,68,0.1); color: #fca5a5; }
    .page-body.admin-mode { padding-bottom: 0 !important; }
  `],
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly visitorService = inject(VisitorLogService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  readonly currentUser$ = this.auth.currentUser$;
  readonly isAdmin$ = this.auth.isAdmin$;
  readonly settings$ = this.settingsService.settings$;

  readonly announcementDismissed = signal<boolean>(false);
  readonly isAdminRoute = signal<boolean>(false);
  readonly isHomePage = signal<boolean>(false);
  mobileNavOpen = false;
  userMenuOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown-wrapper')) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(e: Event): void {
    e.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  ngOnInit(): void {
    this.visitorService.startTracking();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* silent */ });
    }

    const updateRouteState = (url: string) => {
      const clean = (url || '').split('?')[0].split('#')[0];
      const isHome = clean === '/' || clean === '';
      this.isHomePage.set(isHome);
      this.isAdminRoute.set(clean.startsWith('/admin'));
      if (clean.startsWith('/admin') || !isHome) {
        this.cleanupRogueAdNodes();
      }
    };

    updateRouteState(this.router.url);

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      updateRouteState(e.urlAfterRedirects || e.url);
    });
  }

  private cleanupRogueAdNodes(): void {
    if (typeof document === 'undefined') return;
    try {
      // Remove rogue iframes or containers injected outside component boundaries
      const rogueSelectors = [
        'div[id^="container-c9d044db8"]',
        'iframe[src*="highrevenueformat"]',
        'iframe[src*="profitableratecpmnetwork"]',
        'iframe[src*="quge5"]',
        'div[id*="adsterra"]',
        'div[id*="atContainer"]'
      ];
      rogueSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });
    } catch { /* silent */ }
  }

  getBrandFirst(siteName?: string): string {
    const name = siteName || 'Net Mirror BD';
    if (name.toLowerCase().startsWith('stream')) return 'Stream';
    const half = Math.ceil(name.length / 2);
    return name.slice(0, half);
  }

  getBrandRest(siteName?: string): string {
    const name = siteName || 'Net Mirror BD';
    if (name.toLowerCase().startsWith('stream')) return name.slice(6); // everything after 'Stream'
    const half = Math.ceil(name.length / 2);
    return name.slice(half);
  }

  getUserName(user: AppUser): string {
    if (user.displayName) return user.displayName;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  }

  getUserInitial(user: AppUser): string {
    const name = user.displayName || user.email || 'U';
    return name.charAt(0).toUpperCase();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/']);
  }
}

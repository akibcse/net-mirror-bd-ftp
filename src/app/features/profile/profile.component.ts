import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserActivityService } from '../../services/user-activity.service';
import { AppUser } from '../../models/user.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="profile-container" *ngIf="user">
      <div class="profile-header">
        <div class="avatar-large">
          <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName" />
          <span *ngIf="!user.photoURL">{{ userInitial }}</span>
        </div>
        <div class="header-info">
          <div class="title-row">
            <h1>{{ user.displayName }}</h1>
            <span class="role-badge" [class.admin]="user.role === 'admin' || isUserAdmin(user)">
              {{ (user.role === 'admin' || isUserAdmin(user)) ? '🛡️ Admin' : '👤 Member' }}
            </span>
            <a *ngIf="user.role === 'admin' || isUserAdmin(user)" routerLink="/admin" class="btn-profile-admin">
              ⚙️ Admin Panel
            </a>
          </div>
          <p class="email-text">{{ user.email }}</p>
          <p class="member-since">Member since {{ user.createdAt | date:'mediumDate' }}</p>
        </div>
      </div>

      <!-- STATS TILES -->
      <div class="stats-row">
        <div class="stat-tile" [routerLink]="['/my-list']" [queryParams]="{ tab: 'watchlist' }" title="View your saved watchlist">
          <div class="stat-icon">📑</div>
          <div class="stat-meta">
            <span class="stat-count">{{ (watchlist$ | async)?.length || 0 }}</span>
            <span class="stat-lbl">In Watchlist</span>
          </div>
        </div>

        <div class="stat-tile" [routerLink]="['/my-list']" [queryParams]="{ tab: 'favorites' }" title="View your favorites">
          <div class="stat-icon">❤️</div>
          <div class="stat-meta">
            <span class="stat-count">{{ (favorites$ | async)?.length || 0 }}</span>
            <span class="stat-lbl">Favorites</span>
          </div>
        </div>

        <div class="stat-tile" [routerLink]="['/my-list']" [queryParams]="{ tab: 'history' }" title="View your watch history">
          <div class="stat-icon">🕒</div>
          <div class="stat-meta">
            <span class="stat-count">{{ (history$ | async)?.length || 0 }}</span>
            <span class="stat-lbl">Watched Titles</span>
          </div>
        </div>
      </div>

      <!-- TABS / FORMS -->
      <div class="settings-grid">
        <!-- EDIT PROFILE CARD -->
        <div class="settings-card">
          <h2>Profile Details</h2>
          <p class="card-subtitle">Update your personal account display information.</p>

          <div *ngIf="profileSuccess" class="alert-success">✓ Profile updated successfully!</div>
          <div *ngIf="profileError" class="alert-error">⚠️ {{ profileError }}</div>

          <form (ngSubmit)="onSaveProfile()">
            <div class="form-group">
              <label>Display Name</label>
              <input
                type="text"
                [(ngModel)]="editName"
                name="displayName"
                required
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label>Avatar URL (optional image link)</label>
              <input
                type="url"
                [(ngModel)]="editPhotoURL"
                name="photoURL"
                placeholder="https://..."
                class="form-control"
              />
            </div>

            <!-- PRESET AVATARS -->
            <div class="preset-avatars">
              <span class="preset-label">Or choose an avatar:</span>
              <div class="avatar-choices">
                <button
                  type="button"
                  *ngFor="let av of presetAvatars"
                  (click)="editPhotoURL = av"
                  [class.selected]="editPhotoURL === av"
                  class="btn-avatar-choice"
                >
                  <img [src]="av" alt="Avatar option" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="btn-primary"
              [disabled]="savingProfile || !editName.trim()"
            >
              {{ savingProfile ? 'Saving...' : 'Save Changes' }}
            </button>
          </form>
        </div>

        <!-- SECURITY & PASSWORD -->
        <div class="settings-card">
          <h2>Security & Password</h2>
          <p class="card-subtitle">Change your account password or review session options.</p>

          <div *ngIf="pwSuccess" class="alert-success">✓ Password changed successfully!</div>
          <div *ngIf="pwError" class="alert-error">⚠️ {{ pwError }}</div>

          <form (ngSubmit)="onChangePassword()">
            <div class="form-group">
              <label>New Password</label>
              <input
                type="password"
                [(ngModel)]="newPassword"
                name="newPassword"
                required
                minlength="6"
                placeholder="At least 6 characters"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                required
                placeholder="Re-enter new password"
                class="form-control"
              />
            </div>

            <button
              type="submit"
              class="btn-primary"
              [disabled]="savingPw || !newPassword || newPassword !== confirmPassword"
            >
              {{ savingPw ? 'Updating...' : 'Update Password' }}
            </button>
          </form>

          <div class="danger-zone">
            <h3>Account Session</h3>
            <button class="btn-logout" (click)="logout()">Sign Out of Net Mirror BD</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      max-width: 1100px;
      margin: 2rem auto 5rem;
      padding: 0 1.5rem;
    }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 2rem;
      background: linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(17, 24, 39, 0.85) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 2.5rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 640px) {
      .profile-header {
        flex-direction: column;
        text-align: center;
      }
    }
    .avatar-large {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      font-weight: 800;
      overflow: hidden;
      border: 3px solid rgba(255, 255, 255, 0.15);
      flex-shrink: 0;
    }
    .avatar-large img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .title-row h1 {
      font-size: 1.85rem;
      color: #ffffff;
      margin: 0;
    }
    .role-badge {
      background: rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 0.25rem 0.7rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .role-badge.super {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(168, 85, 247, 0.25));
      border-color: #fbbf24;
      color: #fbbf24;
      font-weight: 700;
    }
    .role-badge.admin {
      background: rgba(168, 85, 247, 0.2);
      border-color: #a855f7;
      color: #d8b4fe;
    }
    .btn-profile-admin {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
      text-decoration: none;
      transition: all 0.2s ease;
      margin-left: 0.5rem;
    }
    .btn-profile-admin:hover {
      background: rgba(245, 158, 11, 0.25);
      border-color: #fbbf24;
      transform: translateY(-1px);
    }
    .email-text {
      color: #94a3b8;
      margin: 0.35rem 0 0.2rem;
      font-size: 0.95rem;
    }
    .member-since {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .stat-tile {
      background: rgba(17, 24, 39, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }
    .stat-tile:hover {
      transform: translateY(-3px);
      border-color: rgba(99, 102, 241, 0.4);
      background: rgba(17, 24, 39, 0.9);
    }
    .stat-icon { font-size: 2.2rem; }
    .stat-meta { display: flex; flex-direction: column; }
    .stat-count { font-size: 1.6rem; font-weight: 800; color: #ffffff; }
    .stat-lbl { font-size: 0.85rem; color: #94a3b8; }
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 850px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }
    }
    .settings-card {
      background: rgba(17, 24, 39, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 2rem;
    }
    .settings-card h2 {
      font-size: 1.35rem;
      color: #ffffff;
      margin: 0 0 0.35rem;
    }
    .card-subtitle {
      color: #94a3b8;
      font-size: 0.9rem;
      margin: 0 0 1.5rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      font-size: 0.85rem;
      color: #cbd5e1;
      margin-bottom: 0.4rem;
      font-weight: 500;
    }
    .form-control {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      color: white;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-control:focus {
      border-color: #6366f1;
    }
    .preset-avatars {
      margin-bottom: 1.5rem;
    }
    .preset-label {
      display: block;
      font-size: 0.8rem;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .avatar-choices {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-avatar-choice {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.15);
      background: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s;
    }
    .btn-avatar-choice img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .btn-avatar-choice.selected {
      border-color: #a855f7;
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
    }
    .btn-primary {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      color: white;
      padding: 0.85rem;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .alert-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }
    .danger-zone {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .danger-zone h3 {
      font-size: 1.05rem;
      color: #ffffff;
      margin: 0 0 0.85rem;
    }
    .btn-logout {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-logout:hover {
      background: rgba(239, 68, 68, 0.25);
    }
  `]
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userActivity = inject(UserActivityService);
  private readonly router = inject(Router);

  user: AppUser | null = null;
  editName = '';
  editPhotoURL = '';
  savingProfile = false;
  profileSuccess = false;
  profileError = '';

  newPassword = '';
  confirmPassword = '';
  savingPw = false;
  pwSuccess = false;
  pwError = '';

  watchlist$ = this.userActivity.watchlist$;
  favorites$ = this.userActivity.favorites$;
  history$ = this.userActivity.history$;

  presetAvatars = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Shadow',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Neon',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber'
  ];

  get userInitial(): string {
    return (this.user?.displayName || this.user?.email || 'U').charAt(0).toUpperCase();
  }

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) {
        this.editName = u.displayName || '';
        this.editPhotoURL = u.photoURL || '';
      }
    });
  }

  async onSaveProfile(): Promise<void> {
    if (!this.editName.trim()) return;
    this.savingProfile = true;
    this.profileSuccess = false;
    this.profileError = '';

    try {
      await this.auth.updateProfileData(this.editName.trim(), this.editPhotoURL.trim() || undefined);
      this.profileSuccess = true;
      setTimeout(() => (this.profileSuccess = false), 3500);
    } catch (err: any) {
      this.profileError = err.message || 'Failed to update profile';
    } finally {
      this.savingProfile = false;
    }
  }

  async onChangePassword(): Promise<void> {
    if (!this.newPassword || this.newPassword !== this.confirmPassword) return;
    this.savingPw = true;
    this.pwSuccess = false;
    this.pwError = '';

    try {
      await this.auth.changePassword(this.newPassword);
      this.pwSuccess = true;
      this.newPassword = '';
      this.confirmPassword = '';
      setTimeout(() => (this.pwSuccess = false), 3500);
    } catch (err: any) {
      this.pwError = err.message || 'Failed to change password. You may need to re-login first.';
    } finally {
      this.savingPw = false;
    }
  }

  isUserAdmin(user: AppUser): boolean {
    const emailLower = user.email?.toLowerCase() || '';
    return user.role === 'admin' || !!environment.adminEmails?.map(e => e.toLowerCase()).includes(emailLower);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/']);
  }
}

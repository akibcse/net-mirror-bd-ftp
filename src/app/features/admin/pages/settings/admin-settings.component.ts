import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SettingsService } from '../../../../services/settings.service';
import { SiteSettings } from '../../../../models/media.model';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1>Site General Settings</h1>
          <p>Control branding, global announcement banners, maintenance mode, and platform options.</p>
        </div>
        <button class="btn-primary" (click)="saveSettings()" [disabled]="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

      <div *ngIf="successMsg" class="alert-success">✓ {{ successMsg }}</div>
      <div *ngIf="errorMsg" class="alert-error">⚠️ {{ errorMsg }}</div>

      <div class="settings-grid">
        <!-- BRANDING -->
        <div class="settings-card">
          <h3>Brand & Identity</h3>
          <div class="form-group">
            <label>Site Name</label>
            <input type="text" [(ngModel)]="site.siteName" class="form-control" />
          </div>
          <div class="form-group">
            <label>Site Tagline</label>
            <input type="text" [(ngModel)]="site.siteTagline" class="form-control" />
          </div>
          <div class="form-group">
            <label>Contact Email</label>
            <input type="email" [(ngModel)]="site.contactEmail" class="form-control" />
          </div>
        </div>

        <!-- ANNOUNCEMENT BANNER -->
        <div class="settings-card">
          <h3>Site-wide Announcement Banner</h3>
          <div class="toggle-row">
            <label>Show Announcement Banner</label>
            <button
              class="btn-switch"
              [class.active]="site.announcement?.enabled"
              (click)="toggleAnnouncement()"
            >
              {{ site.announcement?.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div class="form-group" *ngIf="site.announcement?.enabled">
            <label>Banner Message Text</label>
            <input type="text" [(ngModel)]="announcementMessage" class="form-control" placeholder="Welcome to the newly updated Net Mirror BD platform!" />
          </div>
        </div>

        <!-- MAINTENANCE & SECURITY -->
        <div class="settings-card">
          <h3>Platform Modes</h3>
          <div class="toggle-row">
            <div>
              <strong>Maintenance Mode</strong>
              <p class="hint">When enabled, regular visitors see a maintenance screen</p>
            </div>
            <button
              class="btn-switch"
              [class.active]="site.maintenanceMode"
              (click)="site.maintenanceMode = !site.maintenanceMode"
            >
              {{ site.maintenanceMode ? 'ACTIVE' : 'OFF' }}
            </button>
          </div>

          <div class="toggle-row">
            <div>
              <strong>User Registration</strong>
              <p class="hint">Allow new visitors to register accounts</p>
            </div>
            <button
              class="btn-switch"
              [class.active]="site.registrationOpen"
              (click)="site.registrationOpen = !site.registrationOpen"
            >
              {{ site.registrationOpen ? 'OPEN' : 'CLOSED' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
    .page-header h1 { font-size: 1.75rem; color: #ffffff; margin: 0; }
    .page-header p { color: #94a3b8; margin: 0; font-size: 0.9rem; }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      border: none;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
    .settings-card {
      background: rgba(17, 24, 39, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .settings-card h3 { font-size: 1.15rem; color: white; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .form-group label { font-size: 0.85rem; color: #cbd5e1; font-weight: 500; }
    .form-control {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      color: white;
      outline: none;
    }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .toggle-row strong { font-size: 0.9rem; color: white; }
    .hint { margin: 0; font-size: 0.75rem; color: #94a3b8; }
    .btn-switch {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #94a3b8;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .btn-switch.active { background: #22c55e; color: white; border-color: #22c55e; }
    .alert-success { background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(34,197,94,0.25); font-weight: 500; }
    .alert-error { background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(239,68,68,0.25); font-weight: 500; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;

  saving = false;
  successMsg = '';
  errorMsg = '';
  announcementMessage = '';

  site: SiteSettings = {
    siteName: 'Net Mirror BD',
    siteTagline: 'Watch Movies & TV Series Online Free',
    contactEmail: 'support@netmirrorbd.io',
    maintenanceMode: false,
    registrationOpen: true,
    announcement: {
      enabled: false,
      message: 'Welcome to Net Mirror BD! Enjoy unlimited movies in full HD.',
      type: 'info'
    }
  };

  ngOnInit(): void {
    // Subscribe to live settings stream — loads immediately from cache, then updates from Firebase
    this.sub = this.settingsService.settings$.subscribe(s => {
      if (!this.saving) { // Don't overwrite while user is actively saving
        this.site = { ...s };
        this.announcementMessage = s.announcement?.message || '';
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleAnnouncement(): void {
    if (!this.site.announcement) {
      this.site.announcement = { enabled: true, message: this.announcementMessage || 'Welcome to Net Mirror BD!', type: 'info' };
    } else {
      this.site.announcement.enabled = !this.site.announcement.enabled;
    }
  }

  async saveSettings(): Promise<void> {
    this.saving = true;
    this.successMsg = '';
    this.errorMsg = '';
    this.cdr.detectChanges();

    // Sync announcement message into the model before saving
    if (!this.site.announcement) {
      this.site.announcement = { enabled: false, message: this.announcementMessage, type: 'info' };
    } else {
      this.site.announcement = { ...this.site.announcement, message: this.announcementMessage };
    }

    try {
      await this.settingsService.saveSettings(this.site);
      this.ngZone.run(() => {
        this.successMsg = '✅ Settings saved successfully and applied in real time!';
        this.saving = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
      });
    } catch (err: any) {
      console.error('Settings save error:', err);
      this.ngZone.run(() => {
        this.errorMsg = '⚠️ ' + (err?.message || 'Failed to save. Check browser console for details.');
        this.saving = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.errorMsg = ''; this.cdr.detectChanges(); }, 5000);
      });
    }
  }
}

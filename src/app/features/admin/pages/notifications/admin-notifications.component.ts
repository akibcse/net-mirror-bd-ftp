import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../services/notification.service';
import { AdminMediaService } from '../../../../services/admin-media.service';
import { AppNotification, NotificationType } from '../../../../models/media.model';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <div>
          <h1>🔔 Push Notifications</h1>
          <p>Send instant announcements, movie release alerts, and promotional messages to all users in real-time.</p>
        </div>
        <!-- Web Push Status -->
        <div class="push-status-card">
          <div class="push-icon">{{ pushIcon }}</div>
          <div class="push-info">
            <span class="push-label">Browser Push</span>
            <span class="push-state" [class]="'state-' + pushPermission">{{ pushPermissionLabel }}</span>
          </div>
          <button
            class="btn-push-enable"
            *ngIf="pushPermission !== 'granted'"
            (click)="requestPushPermission()"
            [disabled]="pushPermission === 'denied'"
          >
            {{ pushPermission === 'denied' ? '🚫 Blocked' : '🔔 Enable' }}
          </button>
          <button
            class="btn-push-test"
            *ngIf="pushPermission === 'granted'"
            (click)="testPushNotification()"
          >
            🧪 Test
          </button>
        </div>
      </div>

      <div *ngIf="successMsg" class="alert-success">✓ {{ successMsg }}</div>
      <div *ngIf="errorMsg" class="alert-error">⚠️ {{ errorMsg }}</div>

      <div class="notif-grid">
        <!-- COMPOSE CARD -->
        <div class="compose-card">
          <h3>📝 Compose Notification</h3>
          <form (ngSubmit)="sendNotification()">
            <div class="form-group">
              <label>Notification Type</label>
              <select [(ngModel)]="newNotif.type" name="type" class="form-control">
                <option value="release">🎬 New Release Announcement</option>
                <option value="system">⚙️ System / Platform Update</option>
                <option value="promo">🎁 Promotion / Feature Highlight</option>
              </select>
            </div>

            <div class="form-group">
              <label>Title</label>
              <input
                type="text"
                [(ngModel)]="newNotif.title"
                name="title"
                required
                class="form-control"
                placeholder="e.g. Dune: Part Two is now streaming!"
              />
            </div>

            <div class="form-group">
              <label>Message</label>
              <textarea
                [(ngModel)]="newNotif.message"
                name="message"
                required
                rows="3"
                class="form-control"
                placeholder="Write your message to all users..."
              ></textarea>
            </div>

            <div class="form-group">
              <label>Link (optional)</label>
              <input
                type="text"
                [(ngModel)]="newNotif.link"
                name="link"
                class="form-control"
                placeholder="/movie/693134 or /movies"
              />
            </div>

            <div class="send-options">
              <div class="opt-row">
                <label class="toggle-label">
                  <input type="checkbox" [(ngModel)]="sendBrowserPush" name="browserPush" class="toggle-check" />
                  <span class="toggle-track"></span>
                  🖥️ Also send as Browser Push Notification
                </label>
              </div>
            </div>

            <button
              type="submit"
              class="btn-send"
              [disabled]="sending || !newNotif.title.trim() || !newNotif.message.trim()"
            >
              <span *ngIf="!sending">🚀 Broadcast to All Users</span>
              <span *ngIf="sending">📡 Sending...</span>
            </button>
          </form>
        </div>

        <!-- SENT NOTIFICATIONS LIST -->
        <div class="history-card">
          <div class="history-header">
            <h3>📋 Broadcast History</h3>
            <span class="history-count">{{ sentList.length }} sent</span>
          </div>
          <div class="sent-list" *ngIf="sentList.length > 0; else emptyList">
            <div *ngFor="let n of sentList" class="sent-item">
              <div class="sent-header">
                <div class="sent-title-row">
                  <span class="type-icon">{{ getTypeIcon(n.type) }}</span>
                  <strong>{{ n.title }}</strong>
                </div>
                <span class="sent-time">{{ n.createdAt | date:'dd MMM, HH:mm' }}</span>
              </div>
              <p class="sent-msg">{{ n.message }}</p>
              <div class="sent-footer">
                <span class="type-pill" [class]="'type-' + n.type">{{ n.type }}</span>
                <a *ngIf="n.link" [href]="n.link" class="link-tag" target="_blank">{{ n.link }}</a>
                <button class="btn-del" (click)="deleteNotification(n.id)">🗑️ Delete</button>
              </div>
            </div>
          </div>
          <ng-template #emptyList>
            <div class="empty-state">
              <span class="empty-icon">📭</span>
              <p>No broadcast notifications sent yet.</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
    .page-header h1 { font-size: 1.75rem; color: #ffffff; margin: 0; }
    .page-header p { color: #94a3b8; margin: 0.25rem 0 0; font-size: 0.9rem; }

    /* Push Status Card */
    .push-status-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(17,24,39,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 0.85rem 1.2rem;
      min-width: 240px;
    }
    .push-icon { font-size: 1.75rem; }
    .push-info { display: flex; flex-direction: column; flex: 1; }
    .push-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .push-state { font-size: 0.88rem; font-weight: 700; }
    .state-granted { color: #4ade80; }
    .state-denied { color: #f87171; }
    .state-default { color: #fbbf24; }
    .btn-push-enable, .btn-push-test {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      color: white;
      padding: 0.45rem 0.9rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-push-enable:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-push-test { background: linear-gradient(135deg, #0ea5e9, #6366f1); }
    .btn-push-enable:hover:not(:disabled), .btn-push-test:hover { opacity: 0.9; transform: translateY(-1px); }

    /* Alerts */
    .alert-success { background: rgba(34, 197, 94, 0.15); color: #4ade80; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(34,197,94,0.25); }
    .alert-error { background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(239,68,68,0.25); }

    /* Grid */
    .notif-grid { display: grid; grid-template-columns: 440px 1fr; gap: 1.5rem; }
    @media (max-width: 960px) { .notif-grid { grid-template-columns: 1fr; } }

    .compose-card, .history-card {
      background: rgba(17, 24, 39, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1.5rem;
    }
    .compose-card h3, .history-card h3 {
      font-size: 1.1rem;
      color: white;
      margin: 0 0 1.25rem;
    }

    /* Form */
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
    .form-group label { font-size: 0.85rem; color: #cbd5e1; font-weight: 500; }
    .form-control {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      color: white;
      outline: none;
      font-size: 0.9rem;
      transition: border-color 0.2s;
    }
    .form-control:focus { border-color: #6366f1; }
    textarea.form-control { resize: vertical; }

    /* Toggle */
    .send-options { margin: 0.5rem 0 1rem; }
    .opt-row { display: flex; align-items: center; }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      color: #cbd5e1;
      font-size: 0.88rem;
    }
    .toggle-check { display: none; }
    .toggle-track {
      width: 38px; height: 20px;
      background: rgba(255,255,255,0.1);
      border-radius: 9999px;
      position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .toggle-track::after {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      background: white;
      border-radius: 50%;
      top: 3px; left: 3px;
      transition: transform 0.2s;
    }
    .toggle-check:checked + .toggle-track { background: #6366f1; }
    .toggle-check:checked + .toggle-track::after { transform: translateX(18px); }

    /* Send button */
    .btn-send {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      color: white;
      padding: 0.85rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn-send:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* History */
    .history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    .history-count {
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .sent-list { display: flex; flex-direction: column; gap: 1rem; max-height: 600px; overflow-y: auto; }
    .sent-item {
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 1rem;
      transition: background 0.2s;
    }
    .sent-item:hover { background: rgba(255,255,255,0.03); }
    .sent-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem; gap: 0.5rem; }
    .sent-title-row { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
    .sent-title-row strong { color: white; font-size: 0.95rem; }
    .type-icon { font-size: 1.1rem; }
    .sent-time { font-size: 0.75rem; color: #64748b; white-space: nowrap; }
    .sent-msg { color: #cbd5e1; font-size: 0.85rem; margin: 0 0 0.65rem; line-height: 1.5; }
    .sent-footer { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .type-pill {
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .type-release { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .type-system  { background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); }
    .type-promo   { background: rgba(234,179,8,0.2); color: #fcd34d; border: 1px solid rgba(234,179,8,0.3); }
    .link-tag { font-size: 0.75rem; color: #38bdf8; font-family: monospace; }
    .btn-del {
      margin-left: auto;
      background: none;
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-del:hover { background: rgba(239,68,68,0.1); }

    .empty-state { text-align: center; padding: 3rem; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .empty-icon { font-size: 2.5rem; }
    .empty-state p { color: #94a3b8; margin: 0; }
  `]
})
export class AdminNotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly adminMedia = inject(AdminMediaService);
  private readonly cdr = inject(ChangeDetectorRef);

  sending = false;
  successMsg = '';
  errorMsg = '';
  sentList: AppNotification[] = [];
  sendBrowserPush = true;

  pushPermission: NotificationPermission = 'default';

  get pushIcon(): string {
    if (this.pushPermission === 'granted') return '🔔';
    if (this.pushPermission === 'denied') return '🔕';
    return '🔕';
  }

  get pushPermissionLabel(): string {
    if (this.pushPermission === 'granted') return 'Enabled & Active';
    if (this.pushPermission === 'denied') return 'Blocked by Browser';
    return 'Not Enabled';
  }

  newNotif = {
    title: '',
    message: '',
    type: 'release' as NotificationType,
    link: ''
  };

  ngOnInit(): void {
    this.initServiceWorker();
    this.checkPushPermission();
    this.loadSent();
  }

  private initServiceWorker(): void {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('SW registration warning:', err);
      });
    }
  }

  private async triggerBrowserNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    // 1. Try ServiceWorkerRegistration.showNotification (required on mobile Chrome & standard across PWA/modern web)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        }
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, options);
          return;
        }
      } catch (swErr) {
        console.warn('ServiceWorker showNotification fallback warning:', swErr);
      }
    }

    // 2. Safe fallback to window.Notification constructor
    try {
      new Notification(title, options);
    } catch (notifErr) {
      console.warn('Native Notification constructor not supported or illegal in this context:', notifErr);
    }
  }

  checkPushPermission(): void {
    if (typeof Notification !== 'undefined') {
      this.pushPermission = Notification.permission;
    }
    this.cdr.detectChanges();
  }

  async requestPushPermission(): Promise<void> {
    if (typeof Notification === 'undefined') {
      this.errorMsg = 'Browser does not support Web Notifications.';
      return;
    }
    const perm = await Notification.requestPermission();
    this.pushPermission = perm;
    if (perm === 'granted') {
      this.successMsg = '🔔 Browser push notifications enabled!';
      await this.triggerBrowserNotification('Net Mirror BD Admin', {
        body: 'Push notifications are now enabled. You will receive live alerts.',
        icon: '/logo-icon.png'
      });
    } else if (perm === 'denied') {
      this.errorMsg = 'Push notifications were blocked. Please enable in browser settings.';
    }
    this.cdr.detectChanges();
    setTimeout(() => { this.successMsg = ''; this.errorMsg = ''; this.cdr.detectChanges(); }, 4000);
  }

  async testPushNotification(): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    await this.triggerBrowserNotification('Net Mirror BD Test Notification 🎬', {
      body: 'This is a test push notification from the Net Mirror BD Admin Panel.',
      icon: '/logo-icon.png',
      tag: 'test-push'
    });
    this.successMsg = '🧪 Test push notification sent to your browser!';
    this.cdr.detectChanges();
    setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 3000);
  }

  async loadSent(): Promise<void> {
    this.sentList = await this.notificationService.getAllNotifications();
    this.cdr.detectChanges();
  }

  async sendNotification(): Promise<void> {
    if (!this.newNotif.title.trim() || !this.newNotif.message.trim()) return;
    this.sending = true;
    this.errorMsg = '';
    try {
      const payload = {
        title: this.newNotif.title.trim(),
        message: this.newNotif.message.trim(),
        type: this.newNotif.type,
        link: this.newNotif.link.trim() || undefined,
        read: false
      };

      await this.notificationService.sendBroadcastNotification(payload);

      // Fire browser push notification via ServiceWorker / safe fallback
      if (this.sendBrowserPush && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await this.triggerBrowserNotification(`📢 ${payload.title}`, {
          body: payload.message,
          icon: '/logo-icon.png',
          tag: `broadcast-${Date.now()}`
        });
      }

      // Log to audit trail
      await this.adminMedia.logAction('send_notification', payload.type, payload.title);

      this.successMsg = `✅ Broadcast sent to all users${this.sendBrowserPush && Notification.permission === 'granted' ? ' + browser push' : ''}!`;
      this.newNotif = { title: '', message: '', type: 'release', link: '' };
      await this.loadSent();
      this.cdr.detectChanges();
      setTimeout(() => { this.successMsg = ''; this.cdr.detectChanges(); }, 4000);
    } catch (err: any) {
      this.errorMsg = 'Failed to send notification: ' + (err?.message || 'Unknown error');
      this.cdr.detectChanges();
    } finally {
      this.sending = false;
      this.cdr.detectChanges();
    }
  }

  async deleteNotification(id?: string): Promise<void> {
    if (!id) return;
    await this.notificationService.deleteNotification(id);
    await this.adminMedia.logAction('delete_notification', id);
    this.sentList = this.sentList.filter(n => n.id !== id);
    this.cdr.detectChanges();
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      release: '🎬',
      system: '⚙️',
      promo: '🎁'
    };
    return icons[type] || '🔔';
  }
}

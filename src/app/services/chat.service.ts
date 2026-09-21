import { Injectable, inject, NgZone } from '@angular/core';
import {
  ref, push, set, update, get, onValue, off, query, orderByChild
} from 'firebase/database';
import { Observable, BehaviorSubject } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { AppUser } from '../models/user.model';
import { ChatMessage, ChatSession, ChatSessionMeta } from '../models/chat.model';

const SESSION_KEY = 'netmirrorbd_chat_session_id';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly firebase = inject(FirebaseService);
  private readonly zone = inject(NgZone);

  /** Total unread sessions for admin badge */
  readonly adminUnreadCount$ = new BehaviorSubject<number>(0);

  constructor() {
    this.watchAdminUnread();
  }

  // ─── Session Management ───────────────────────────────────────────────────

  /** Start or resume a session for a logged-in user */
  async startUserSession(user: AppUser): Promise<string> {
    // Try to resume existing open session by UID
    const existing = await this.findOpenSessionByUid(user.uid);
    if (existing) {
      localStorage.setItem(SESSION_KEY, existing);
      return existing;
    }

    const sessionRef = push(ref(this.firebase.db, 'chats'));
    const sessionId = sessionRef.key!;
    const meta: ChatSessionMeta = {
      type: 'user',
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      status: 'open',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      unreadByAdmin: 0,
      unreadByUser: 0,
    };
    await set(ref(this.firebase.db, `chats/${sessionId}/meta`), meta);
    localStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  }

  /** Start a guest session */
  async startGuestSession(email: string, phone: string, displayName?: string): Promise<string> {
    // Check if we already have a stored session
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const existing = await this.getSessionMeta(stored);
      if (existing && existing.status === 'open') return stored;
    }

    const sessionRef = push(ref(this.firebase.db, 'chats'));
    const sessionId = sessionRef.key!;
    const meta: ChatSessionMeta = {
      type: 'guest',
      displayName: displayName || email.split('@')[0],
      email,
      phone,
      status: 'open',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
      unreadByAdmin: 0,
      unreadByUser: 0,
    };
    await set(ref(this.firebase.db, `chats/${sessionId}/meta`), meta);
    localStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  }

  /** Get stored local session ID (guest persistence) */
  getLocalSessionId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  /** Clear local session */
  clearLocalSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  /** Close a chat session */
  async closeSession(sessionId: string): Promise<void> {
    await update(ref(this.firebase.db, `chats/${sessionId}/meta`), { status: 'closed' });
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  async sendMessage(sessionId: string, text: string, sender: 'user' | 'admin'): Promise<void> {
    const msgRef = push(ref(this.firebase.db, `chats/${sessionId}/messages`));
    const msg: ChatMessage = { text, sender, timestamp: Date.now() };
    await set(msgRef, msg);

    const metaUpdate: any = { lastMessageAt: Date.now() };
    if (sender === 'user') {
      metaUpdate.unreadByAdmin = await this.incrementField(sessionId, 'unreadByAdmin');
    } else {
      metaUpdate.unreadByUser = await this.incrementField(sessionId, 'unreadByUser');
    }
    await update(ref(this.firebase.db, `chats/${sessionId}/meta`), metaUpdate);
  }

  /**
   * Admin sends a reply — also writes a Firebase in-app notification to the user
   * (if session belongs to a logged-in user with a uid) so it appears in their
   * notifications feed and triggers a browser push notification.
   */
  async sendAdminReply(sessionId: string, text: string, meta: ChatSessionMeta): Promise<void> {
    await this.sendMessage(sessionId, text, 'admin');

    // In-app notification for logged-in users only
    if (meta.uid) {
      await this.writeUserNotification(meta.uid, '💬 Admin replied to your chat', text);
    }

    // Trigger browser push to admin-facing SW if user tab is open
    this.fireBrowserNotification('Admin Reply', text, '/');
  }

  /**
   * User sends a message — also writes a Firebase in-app notification to all admins
   * (stored at notifications/admin_chat_alerts) and shows a SW notification.
   */
  async sendUserMessage(sessionId: string, text: string, displayName: string): Promise<void> {
    await this.sendMessage(sessionId, text, 'user');
    // Write alert for admin — stored at a dedicated path the admin shell can watch
    await push(ref(this.firebase.db, 'notifications/admin_chat_alerts'), {
      sessionId,
      displayName,
      preview: text.length > 60 ? text.slice(0, 60) + '…' : text,
      timestamp: Date.now(),
      read: false
    });
  }

  /** Request browser notification permission (call once on user interaction) */
  async requestBrowserPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.requestPermission();
  }

  /** Show a local browser notification via service worker if available */
  fireBrowserNotification(title: string, body: string, url: string = '/'): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/logo-icon.png',
            badge: '/logo-icon.png',
            tag: 'chat-message',
            renotify: true,
            data: { url }
          } as NotificationOptions);
        }).catch(() => this.showFallbackNotification(title, body));
      } else {
        this.showFallbackNotification(title, body);
      }
    } catch { /* silent */ }
  }

  private showFallbackNotification(title: string, body: string): void {
    try { new Notification(title, { body, icon: '/logo-icon.png' }); } catch { /* silent */ }
  }

  /** Write a targeted in-app notification to a specific user's Firebase path */
  private async writeUserNotification(uid: string, title: string, message: string): Promise<void> {
    try {
      await push(ref(this.firebase.db, `notifications/users/${uid}`), {
        type: 'system',
        title,
        message: message.length > 120 ? message.slice(0, 120) + '…' : message,
        read: false,
        userId: uid,
        createdAt: Date.now()
      });
    } catch { /* silent */ }
  }

  /** Mark messages as read by user (reset unreadByUser counter) */
  async markReadByUser(sessionId: string): Promise<void> {
    await update(ref(this.firebase.db, `chats/${sessionId}/meta`), { unreadByUser: 0 });
  }

  /** Mark messages as read by admin (reset unreadByAdmin counter) */
  async markReadByAdmin(sessionId: string): Promise<void> {
    await update(ref(this.firebase.db, `chats/${sessionId}/meta`), { unreadByAdmin: 0 });
  }

  // ─── Real-time Observables ────────────────────────────────────────────────

  /** Real-time messages for a session */
  getMessages$(sessionId: string): Observable<ChatMessage[]> {
    return new Observable<ChatMessage[]>(observer => {
      const msgsRef = ref(this.firebase.db, `chats/${sessionId}/messages`);
      const listener = onValue(msgsRef, snapshot => {
        this.zone.run(() => {
          if (!snapshot.exists()) { observer.next([]); return; }
          const data = snapshot.val() as Record<string, ChatMessage>;
          const msgs = Object.entries(data).map(([id, m]) => ({ ...m, id }));
          msgs.sort((a, b) => a.timestamp - b.timestamp);
          observer.next(msgs);
        });
      }, err => this.zone.run(() => observer.error(err)));
      return () => off(msgsRef, 'value', listener);
    });
  }

  /** Real-time session meta for a single session */
  getSessionMeta$(sessionId: string): Observable<ChatSessionMeta | null> {
    return new Observable<ChatSessionMeta | null>(observer => {
      const metaRef = ref(this.firebase.db, `chats/${sessionId}/meta`);
      const listener = onValue(metaRef, snapshot => {
        this.zone.run(() => {
          observer.next(snapshot.exists() ? (snapshot.val() as ChatSessionMeta) : null);
        });
      }, err => this.zone.run(() => observer.error(err)));
      return () => off(metaRef, 'value', listener);
    });
  }

  /** Real-time list of all chat sessions (for admin panel) */
  getAllSessions$(): Observable<ChatSession[]> {
    return new Observable<ChatSession[]>(observer => {
      const chatsRef = query(ref(this.firebase.db, 'chats'), orderByChild('meta/createdAt'));
      const listener = onValue(chatsRef, snapshot => {
        this.zone.run(() => {
          if (!snapshot.exists()) { observer.next([]); return; }
          const data = snapshot.val() as Record<string, any>;
          const sessions: ChatSession[] = Object.entries(data).map(([id, val]) => ({
            id,
            meta: val.meta as ChatSessionMeta,
            messages: val.messages
          }));
          sessions.sort((a, b) => b.meta.lastMessageAt - a.meta.lastMessageAt);
          observer.next(sessions);
        });
      }, err => this.zone.run(() => observer.error(err)));
      return () => off(chatsRef, 'value', listener);
    });
  }

  /** Set admin online status visible to users */
  async setAdminOnline(online: boolean): Promise<void> {
    await set(ref(this.firebase.db, 'chat_admin_status/online'), online);
    await set(ref(this.firebase.db, 'chat_admin_status/updatedAt'), Date.now());
  }

  getAdminOnline$(): Observable<boolean> {
    return new Observable<boolean>(observer => {
      const statusRef = ref(this.firebase.db, 'chat_admin_status/online');
      const listener = onValue(statusRef, snapshot => {
        this.zone.run(() => observer.next(snapshot.exists() ? !!snapshot.val() : false));
      });
      return () => off(statusRef, 'value', listener);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findOpenSessionByUid(uid: string): Promise<string | null> {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const meta = await this.getSessionMeta(stored);
      if (meta && meta.uid === uid && meta.status === 'open') return stored;
    }
    return null;
  }

  private async getSessionMeta(sessionId: string): Promise<ChatSessionMeta | null> {
    const snap = await get(ref(this.firebase.db, `chats/${sessionId}/meta`));
    return snap.exists() ? (snap.val() as ChatSessionMeta) : null;
  }

  private async incrementField(sessionId: string, field: 'unreadByAdmin' | 'unreadByUser'): Promise<number> {
    const snap = await get(ref(this.firebase.db, `chats/${sessionId}/meta/${field}`));
    return (snap.exists() ? (snap.val() as number) : 0) + 1;
  }

  private watchAdminUnread(): void {
    const chatsRef = ref(this.firebase.db, 'chats');
    onValue(chatsRef, snapshot => {
      this.zone.run(() => {
        if (!snapshot.exists()) { this.adminUnreadCount$.next(0); return; }
        const data = snapshot.val() as Record<string, any>;
        const count = Object.values(data).filter(
          (s: any) => s?.meta?.status === 'open' && (s?.meta?.unreadByAdmin ?? 0) > 0
        ).length;
        this.adminUnreadCount$.next(count);
      });
    });
  }
}

import {
  Component, OnInit, OnDestroy, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatMessage } from '../../models/chat.model';

type ChatStep = 'closed' | 'guest-form' | 'open';

@Component({
  selector: 'app-live-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── Floating Bubble ─────────────────────────────────────── -->
    <button
      id="live-chat-bubble"
      class="chat-bubble"
      [class.has-unread]="unreadCount() > 0"
      (click)="onBubbleClick()"
      title="Chat with us"
      aria-label="Open live chat"
    >
      <span class="bubble-icon" *ngIf="chatStep() !== 'open'">💬</span>
      <span class="bubble-icon" *ngIf="chatStep() === 'open'">✕</span>
      <span class="unread-badge" *ngIf="unreadCount() > 0 && chatStep() !== 'open'">
        {{ unreadCount() }}
      </span>
    </button>

    <!-- ── Chat Window ─────────────────────────────────────────── -->
    <div
      class="chat-window"
      [class.open]="chatStep() !== 'closed'"
      role="dialog"
      aria-label="Live chat"
    >
      <!-- Header -->
      <div class="cw-header">
        <div class="cw-header-left">
          <div class="cw-avatar">🛡️</div>
          <div class="cw-hinfo">
            <span class="cw-title">Net Mirror BD Support</span>
            <span class="cw-status" [class.online]="adminOnline()">
              <span class="status-dot"></span>
              {{ adminOnline() ? 'Admin is online' : 'Leave a message' }}
            </span>
          </div>
        </div>
        <button class="cw-close" (click)="close()" aria-label="Close chat">✕</button>
      </div>

      <!-- Guest Form -->
      <div class="cw-guest-form" *ngIf="chatStep() === 'guest-form'">
        <div class="gf-intro">
          <p class="gf-title">👋 Start a conversation</p>
          <p class="gf-sub">Enter your details and we'll get back to you instantly.</p>
        </div>
        <form (ngSubmit)="submitGuestForm()" #guestForm="ngForm">
          <div class="gf-field">
            <label for="chat-email">Email address *</label>
            <input
              id="chat-email"
              type="email"
              [(ngModel)]="guestEmail"
              name="email"
              required
              placeholder="you@example.com"
              class="gf-input"
            />
          </div>
          <div class="gf-field">
            <label for="chat-phone">Phone number *</label>
            <input
              id="chat-phone"
              type="tel"
              [(ngModel)]="guestPhone"
              name="phone"
              required
              placeholder="+880 1X XXX XXXXX"
              class="gf-input"
            />
          </div>
          <div *ngIf="guestError" class="gf-error">{{ guestError }}</div>
          <button
            type="submit"
            class="gf-btn"
            [disabled]="guestSubmitting"
          >
            {{ guestSubmitting ? 'Starting chat…' : 'Start Chat 💬' }}
          </button>
        </form>
      </div>

      <!-- Message Area -->
      <div class="cw-messages" #msgContainer *ngIf="chatStep() === 'open'" id="chat-messages-list">
        <div class="cw-msgs-inner">
          <!-- Welcome message -->
          <div class="msg-row admin">
            <div class="msg-bubble admin-bubble">
              👋 Hello! How can we help you today?
            </div>
          </div>

          <div
            *ngFor="let msg of messages()"
            class="msg-row"
            [class.user]="msg.sender === 'user'"
            [class.admin]="msg.sender === 'admin'"
          >
            <div class="msg-bubble" [class.user-bubble]="msg.sender === 'user'" [class.admin-bubble]="msg.sender === 'admin'">
              {{ msg.text }}
              <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
          </div>

          <!-- Typing indicator -->
          <div class="msg-row admin" *ngIf="adminTyping">
            <div class="msg-bubble admin-bubble typing-bubble">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>

          <!-- Session closed notice -->
          <div class="session-closed-notice" *ngIf="sessionClosed">
            <span>This chat session has been closed by admin.</span>
            <button (click)="startNewSession()" class="btn-new-session">Start New Chat</button>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="cw-input-bar" *ngIf="chatStep() === 'open' && !sessionClosed">
        <textarea
          id="chat-message-input"
          class="cw-textarea"
          [(ngModel)]="messageText"
          placeholder="Type a message…"
          rows="1"
          (keydown.enter)="onEnterKey($event)"
          [disabled]="sending"
        ></textarea>
        <button
          class="cw-send"
          (click)="sendMessage()"
          [disabled]="!messageText.trim() || sending"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9000;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ── Bubble ─────────────────────────────────────── */
    .chat-bubble {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      box-shadow: 0 8px 32px rgba(99,102,241,0.5), 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      animation: bubblePulse 3s ease-in-out infinite;
    }
    .chat-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 12px 40px rgba(99,102,241,0.65), 0 4px 12px rgba(0,0,0,0.4);
    }
    @keyframes bubblePulse {
      0%, 100% { box-shadow: 0 8px 32px rgba(99,102,241,0.5), 0 2px 8px rgba(0,0,0,0.3); }
      50% { box-shadow: 0 8px 40px rgba(99,102,241,0.75), 0 2px 8px rgba(0,0,0,0.3); }
    }
    .chat-bubble.has-unread {
      animation: bubblePulse 1.5s ease-in-out infinite;
    }

    .bubble-icon { line-height: 1; }

    .unread-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: #ef4444;
      color: white;
      font-size: 0.68rem;
      font-weight: 700;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #0b0e14;
      animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes badgePop {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }

    /* ── Chat Window ────────────────────────────────── */
    .chat-window {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 360px;
      max-height: 520px;
      background: #0f1219;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.85) translateY(20px);
      transform-origin: bottom right;
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
    }
    .chat-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    @media (max-width: 480px) {
      :host { bottom: 80px; right: 12px; }
      .chat-window { width: calc(100vw - 24px); right: 0; bottom: 68px; }
    }

    /* ── Header ─────────────────────────────────────── */
    .cw-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.1rem;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    .cw-header-left { display: flex; align-items: center; gap: 0.75rem; }
    .cw-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(99,102,241,0.3);
      border: 2px solid rgba(99,102,241,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem;
    }
    .cw-hinfo { display: flex; flex-direction: column; gap: 2px; }
    .cw-title { font-size: 0.9rem; font-weight: 700; color: #f0f6fc; }
    .cw-status {
      font-size: 0.72rem;
      color: #94a3b8;
      display: flex; align-items: center; gap: 4px;
    }
    .cw-status.online { color: #4ade80; }
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor;
      display: inline-block;
    }
    .cw-status.online .status-dot { animation: blink 1.5s ease-in-out infinite; }
    @keyframes blink {
      0%,100% { opacity: 1; } 50% { opacity: 0.3; }
    }
    .cw-close {
      background: rgba(255,255,255,0.1);
      border: none; color: #94a3b8;
      width: 28px; height: 28px; border-radius: 50%;
      cursor: pointer; font-size: 0.8rem;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, color 0.2s;
    }
    .cw-close:hover { background: rgba(239,68,68,0.2); color: #f87171; }

    /* ── Guest Form ─────────────────────────────────── */
    .cw-guest-form {
      padding: 1.25rem;
      overflow-y: auto;
      flex: 1;
    }
    .gf-intro { margin-bottom: 1.25rem; }
    .gf-title { font-size: 1rem; font-weight: 700; color: #f0f6fc; margin: 0 0 0.3rem; }
    .gf-sub { font-size: 0.8rem; color: #94a3b8; margin: 0; }
    .gf-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.9rem; }
    .gf-field label { font-size: 0.78rem; font-weight: 600; color: #94a3b8; }
    .gf-input {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #f0f6fc;
      padding: 0.65rem 0.85rem;
      font-size: 0.88rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .gf-input:focus { border-color: rgba(99,102,241,0.6); }
    .gf-error { color: #f87171; font-size: 0.78rem; margin-bottom: 0.75rem; }
    .gf-btn {
      width: 100%;
      padding: 0.75rem;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
    }
    .gf-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .gf-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ── Messages ───────────────────────────────────── */
    .cw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .cw-msgs-inner { display: flex; flex-direction: column; gap: 0.6rem; }

    .msg-row { display: flex; }
    .msg-row.user { justify-content: flex-end; }
    .msg-row.admin { justify-content: flex-start; }

    .msg-bubble {
      max-width: 78%;
      padding: 0.6rem 0.85rem;
      border-radius: 16px;
      font-size: 0.86rem;
      line-height: 1.5;
      word-break: break-word;
      position: relative;
    }
    .user-bubble {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .admin-bubble {
      background: rgba(255,255,255,0.07);
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .msg-time {
      display: block;
      font-size: 0.65rem;
      opacity: 0.6;
      margin-top: 2px;
      text-align: right;
    }

    /* Typing dots */
    .typing-bubble { padding: 0.7rem 1rem; }
    .dot {
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #94a3b8;
      margin: 0 2px;
      animation: typingDot 1.2s ease-in-out infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingDot {
      0%,80%,100% { transform: translateY(0); opacity: 0.5; }
      40% { transform: translateY(-6px); opacity: 1; }
    }

    /* Session closed */
    .session-closed-notice {
      text-align: center;
      padding: 0.75rem;
      border: 1px dashed rgba(99,102,241,0.3);
      border-radius: 10px;
      font-size: 0.78rem;
      color: #94a3b8;
      display: flex; flex-direction: column; gap: 0.5rem; align-items: center;
    }
    .btn-new-session {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.4rem 0.9rem;
      font-size: 0.8rem;
      cursor: pointer;
      font-weight: 600;
    }

    /* ── Input Bar ──────────────────────────────────── */
    .cw-input-bar {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.02);
      flex-shrink: 0;
    }
    .cw-textarea {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      color: #f0f6fc;
      font-size: 0.86rem;
      font-family: inherit;
      padding: 0.6rem 0.85rem;
      resize: none;
      outline: none;
      line-height: 1.5;
      max-height: 100px;
      overflow-y: auto;
      transition: border-color 0.2s;
    }
    .cw-textarea:focus { border-color: rgba(99,102,241,0.5); }
    .cw-textarea::placeholder { color: #4b5563; }
    .cw-send {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.2s, transform 0.15s;
    }
    .cw-send:hover:not(:disabled) { opacity: 0.9; transform: scale(1.08); }
    .cw-send:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class LiveChatWidgetComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly chatService = inject(ChatService);

  readonly chatStep = signal<ChatStep>('closed');
  readonly messages = signal<ChatMessage[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly adminOnline = signal<boolean>(false);

  sessionId: string | null = null;
  sessionClosed = false;
  adminTyping = false;
  sending = false;
  messageText = '';

  // Guest form
  guestEmail = '';
  guestPhone = '';
  guestError = '';
  guestSubmitting = false;

  private subs: Subscription[] = [];
  private msgContainerEl: Element | null = null;

  ngOnInit(): void {
    // Watch admin online status
    this.subs.push(
      this.chatService.getAdminOnline$().subscribe(v => this.adminOnline.set(v))
    );

    // Auto-try to resume session for logged-in users
    this.subs.push(
      this.auth.currentUser$.subscribe(async user => {
        if (user && this.chatStep() === 'closed') {
          // Pre-load session if they had one
          const stored = this.chatService.getLocalSessionId();
          if (stored) {
            this.chatService.getSessionMeta$(stored).subscribe(meta => {
              if (meta && meta.uid === user.uid && meta.status === 'open') {
                this.sessionId = stored;
                this.setupMessageStream(stored);
              }
            });
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  onBubbleClick(): void {
    if (this.chatStep() === 'open') {
      this.close();
      return;
    }
    this.open();
  }

  async open(): Promise<void> {
    const user = this.auth.currentUser;

    // Request browser notification permission on first interaction
    await this.chatService.requestBrowserPermission();

    if (user) {
      // Logged-in: start/resume session immediately
      if (!this.sessionId) {
        this.sessionId = await this.chatService.startUserSession(user);
        this.setupMessageStream(this.sessionId);
      }
      this.chatStep.set('open');
      this.unreadCount.set(0);
      if (this.sessionId) {
        await this.chatService.markReadByUser(this.sessionId);
      }
    } else {
      // Guest: check if they have an existing session
      const stored = this.chatService.getLocalSessionId();
      if (stored) {
        this.chatService.getSessionMeta$(stored).subscribe(async meta => {
          if (meta && meta.status === 'open') {
            this.sessionId = stored;
            this.setupMessageStream(stored);
            this.chatStep.set('open');
            await this.chatService.markReadByUser(stored);
          } else {
            this.chatStep.set('guest-form');
          }
        });
        return;
      }
      this.chatStep.set('guest-form');
    }
  }

  close(): void {
    this.chatStep.set('closed');
  }

  async submitGuestForm(): Promise<void> {
    if (!this.guestEmail || !this.guestPhone) {
      this.guestError = 'Both email and phone are required.';
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.guestEmail)) {
      this.guestError = 'Please enter a valid email address.';
      return;
    }
    this.guestError = '';
    this.guestSubmitting = true;
    try {
      this.sessionId = await this.chatService.startGuestSession(this.guestEmail, this.guestPhone);
      this.setupMessageStream(this.sessionId);
      this.chatStep.set('open');
    } catch (e) {
      this.guestError = 'Failed to start chat. Please try again.';
    } finally {
      this.guestSubmitting = false;
    }
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText.trim();
    if (!text || !this.sessionId || this.sending) return;
    this.messageText = '';
    this.sending = true;
    const displayName = this.auth.currentUser?.displayName
      || this.auth.currentUser?.email?.split('@')[0]
      || this.guestEmail?.split('@')[0]
      || 'User';
    try {
      await this.chatService.sendUserMessage(this.sessionId, text, displayName);
      setTimeout(() => this.scrollToBottom(), 100);
    } finally {
      this.sending = false;
    }
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  async startNewSession(): Promise<void> {
    this.chatService.clearLocalSession();
    this.sessionId = null;
    this.messages.set([]);
    this.sessionClosed = false;
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.chatStep.set('guest-form');
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private setupMessageStream(sessionId: string): void {
    let prevCount = 0;
    // Watch messages
    const msgSub = this.chatService.getMessages$(sessionId).subscribe(msgs => {
      const newAdminMsgs = msgs.filter(m => m.sender === 'admin');
      // Show browser notification if widget is closed and new admin message arrived
      if (this.chatStep() !== 'open' && newAdminMsgs.length > prevCount) {
        const latest = newAdminMsgs[newAdminMsgs.length - 1];
        this.chatService.fireBrowserNotification(
          '💬 Net Mirror BD Support',
          latest.text,
          '/'
        );
      }
      prevCount = newAdminMsgs.length;
      this.messages.set(msgs);
      setTimeout(() => this.scrollToBottom(), 50);
    });
    this.subs.push(msgSub);

    // Watch meta (status & unread)
    const metaSub = this.chatService.getSessionMeta$(sessionId).subscribe(meta => {
      if (!meta) return;
      this.sessionClosed = meta.status === 'closed';
      if (this.chatStep() !== 'open') {
        this.unreadCount.set(meta.unreadByUser ?? 0);
      }
    });
    this.subs.push(metaSub);
  }

  private scrollToBottom(): void {
    const el = document.getElementById('chat-messages-list');
    if (el) el.scrollTop = el.scrollHeight;
  }
}

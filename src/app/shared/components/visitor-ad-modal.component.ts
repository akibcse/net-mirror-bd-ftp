import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef,
  ElementRef, ViewChild, AfterViewInit, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter, combineLatest } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { AdCooldownService } from '../../services/ad-cooldown.service';
import { AdTriggerService } from '../../services/ad-trigger.service';
import { AdConfig } from '../../models/media.model';

const TOTAL_COUNTDOWN_SECONDS = 30;

@Component({
  selector: 'app-visitor-ad-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ad-interstitial-backdrop" *ngIf="isVisible" (click)="$event.stopPropagation()">
      <div class="ad-interstitial-card">
        <!-- Header with Countdown and Badges -->
        <div class="ad-card-header">
          <div class="header-left">
            <span class="sponsor-badge">📢 SPONSOR ADVERTISEMENT</span>
            <span class="cooldown-tag">24h Ad-Free Reward</span>
            <span class="stream-tag" *ngIf="secondsRemaining > 0">
              ⚡ Live Ad Stream #{{ adCycle }}
            </span>
          </div>

          <div class="header-right">
            <!-- Paused chip when tab is hidden -->
            <div class="timer-chip paused" *ngIf="isTabPaused && secondsRemaining > 0">
              <span class="timer-icon">⏸️</span>
              <span class="timer-text">Paused (Stay on Tab)</span>
            </div>

            <!-- Active / Complete Timer Chip -->
            <div class="timer-chip" [class.complete]="secondsRemaining === 0" *ngIf="!isTabPaused || secondsRemaining === 0">
              <span class="timer-icon">{{ secondsRemaining > 0 ? '⏱️' : '✅' }}</span>
              <span class="timer-text" *ngIf="secondsRemaining > 0">{{ secondsRemaining }}s remaining</span>
              <span class="timer-text complete" *ngIf="secondsRemaining === 0">Done! Continuing...</span>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="timer-progress-track">
          <div
            class="timer-progress-fill"
            [style.width.%]="progressPercent"
            [class.complete]="secondsRemaining === 0"
            [class.paused]="isTabPaused"
          ></div>
        </div>

        <!-- Explanatory Notice -->
        <div class="ad-info-bar" [class.warning-bar]="isTabPaused">
          <p class="ad-info-text">
            <span class="bullet" *ngIf="!isTabPaused">✨</span>
            <span class="bullet" *ngIf="isTabPaused">⚠️</span>
            <strong *ngIf="isTabPaused">Timer paused! You must stay on this tab for the full 30 seconds to unlock 24h ad-free access.</strong>
            <strong *ngIf="!isTabPaused && secondsRemaining > 0">Please wait {{ secondsRemaining }}s while we load your content. Ads support this free platform!</strong>
            <strong *ngIf="secondsRemaining === 0">Done! Taking you to your content now. Enjoy 24 hours ad-free!</strong>
          </p>
        </div>

        <!-- Ad Content Slot: Monetag & Adsterra Active Ads -->
        <div class="ad-content-slot">
          <div #adContainer class="ad-inject-container"></div>

          <!-- Adsterra Smartlink High-CPM Conversion Bar -->
          <div class="smartlink-banner">
            <div class="sl-inner">
              <div class="sl-badge">⚡ SPONSOR REWARD OFFER</div>
              <p class="sl-text">Support Net Mirror BD — Check out top premium streaming offers &amp; partner deals</p>
              <a
                href="https://www.profitableratecpmnetwork.com/wi20vj0k7n?key=08224ba61f33a164c53d1f93fc13d95b"
                target="_blank"
                rel="noopener sponsored"
                class="btn-smartlink"
              >
                <span>🚀 Visit Special Offer</span>
                <span class="sl-arrow">&rarr;</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="ad-card-footer">
          <div class="footer-note">
            <span class="shield-icon">🛡️</span>
            <span>This ad supports free streaming. Next ad in 24 hours.</span>
          </div>

          <!-- Counting down: disabled button showing remaining time -->
          <button
            *ngIf="secondsRemaining > 0"
            type="button"
            class="btn-continue-site"
            disabled
          >
            <span *ngIf="!isTabPaused">⏳ Loading content... {{ secondsRemaining }}s</span>
            <span *ngIf="isTabPaused">⏸️ Paused — stay on this tab</span>
          </button>

          <!-- Finished: navigate to movie -->
          <button
            *ngIf="secondsRemaining === 0"
            type="button"
            class="btn-continue-site ready btn-completed"
            (click)="dismissAd()"
          >
            ✓ 24h Pass Granted! Continue &rarr;
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ad-interstitial-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }

    .ad-interstitial-card {
      background: rgba(13, 18, 29, 0.72);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(229, 9, 20, 0.15);
      border-radius: 18px;
      max-width: 820px;
      width: 100%;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .ad-card-header {
      padding: 1.1rem 1.4rem;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .sponsor-badge {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #f87171;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
    }

    .cooldown-tag {
      font-size: 0.7rem;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
    }

    .stream-tag {
      font-size: 0.7rem;
      font-weight: 700;
      color: #c084fc;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.35);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      animation: pulseStream 2s infinite ease-in-out;
    }

    @keyframes pulseStream {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.75; transform: scale(0.98); }
    }

    .timer-chip {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(229, 9, 20, 0.18);
      border: 1px solid rgba(229, 9, 20, 0.4);
      color: #ffffff;
      padding: 0.35rem 0.8rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.85rem;
      transition: all 0.3s;
    }

    .timer-chip.paused {
      background: rgba(234, 179, 8, 0.2);
      border-color: rgba(234, 179, 8, 0.5);
      color: #facc15;
      animation: blinkPaused 1.2s infinite;
    }

    @keyframes blinkPaused {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .timer-chip.complete {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.5);
      color: #4ade80;
    }

    /* Progress bar */
    .timer-progress-track {
      height: 4px;
      background: rgba(255, 255, 255, 0.06);
      width: 100%;
      overflow: hidden;
    }

    .timer-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #e50914, #ff4b4b);
      transition: width 1s linear;
    }

    .timer-progress-fill.paused {
      background: #eab308;
    }

    .timer-progress-fill.complete {
      background: #22c55e;
    }

    /* Info bar */
    .ad-info-bar {
      background: rgba(15, 23, 42, 0.35);
      padding: 0.65rem 1.4rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s ease;
    }

    .ad-info-bar.warning-bar {
      background: rgba(234, 179, 8, 0.12);
      border-bottom: 1px solid rgba(234, 179, 8, 0.3);
    }

    .ad-info-bar.warning-bar .ad-info-text {
      color: #fef08a;
    }

    .ad-info-text {
      margin: 0;
      font-size: 0.82rem;
      color: #94a3b8;
      line-height: 1.4;
    }

    .ad-info-text strong {
      color: #f1f5f9;
    }

    .bullet {
      color: #e50914;
      margin-right: 0.3rem;
    }

    /* Ad content container */
    .ad-content-slot {
      padding: 1.25rem 1.4rem;
      overflow-y: auto;
      max-height: 60vh;
      min-height: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      background: rgba(9, 13, 22, 0.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .ad-inject-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      overflow: hidden;
      min-height: 180px;
    }

    .ad-inject-container ::ng-deep iframe {
      border: none;
      max-width: 100%;
    }

    .ad-inject-container ::ng-deep img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    .adsterra-native-wrap {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80px;
    }

    .adsterra-banner-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 250px;
      width: 100%;
    }

    .smartlink-banner {
      width: 100%;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08));
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      padding: 0.85rem 1.2rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .sl-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .sl-badge {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      white-space: nowrap;
    }

    .sl-text {
      margin: 0;
      font-size: 0.82rem;
      color: #cbd5e1;
      flex: 1;
      min-width: 200px;
    }

    .btn-smartlink {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, #e50914, #ff3b30);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(229, 9, 20, 0.4);
      white-space: nowrap;
    }

    .btn-smartlink:hover {
      background: linear-gradient(135deg, #f40612, #ff5247);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(229, 9, 20, 0.6);
    }

    .sl-arrow {
      font-size: 1rem;
      transition: transform 0.2s;
    }

    .btn-smartlink:hover .sl-arrow {
      transform: translateX(3px);
    }

    /* Footer */
    .ad-card-footer {
      padding: 1.1rem 1.4rem;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .footer-note {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.78rem;
    }

    .shield-icon {
      font-size: 1rem;
    }

    .btn-continue-site {
      padding: 0.75rem 1.6rem;
      border-radius: 10px;
      font-size: 0.92rem;
      font-weight: 700;
      border: none;
      cursor: not-allowed;
      background: rgba(255, 255, 255, 0.08);
      color: #64748b;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: inherit;
    }

    .btn-continue-site.ready {
      cursor: pointer;
      background: #22c55e;
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
      transform: translateY(-1px);
    }

    .btn-continue-site.ready:hover {
      background: #16a34a;
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
    }

    .btn-continue-site.btn-start-session {
      background: linear-gradient(135deg, #e50914, #b91c1c);
      color: #ffffff;
      box-shadow: 0 4px 18px rgba(229, 9, 20, 0.5);
      animation: pulseBtn 2s infinite ease-in-out;
    }

    .btn-continue-site.btn-start-session:hover {
      background: linear-gradient(135deg, #f40612, #dc2626);
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(229, 9, 20, 0.7);
    }

    .btn-continue-site.btn-completed {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      animation: pulseGreen 2s infinite ease-in-out;
    }

    @keyframes pulseBtn {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 18px rgba(229, 9, 20, 0.5); }
      50% { transform: scale(1.02); box-shadow: 0 6px 24px rgba(229, 9, 20, 0.7); }
    }

    @keyframes pulseGreen {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); }
      50% { transform: scale(1.02); box-shadow: 0 6px 25px rgba(34, 197, 94, 0.7); }
    }

    @media (max-width: 640px) {
      .ad-interstitial-card {
        border-radius: 14px;
      }
      .ad-card-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .ad-card-footer {
        flex-direction: column;
        align-items: stretch;
      }
      .btn-continue-site {
        width: 100%;
        text-align: center;
      }
    }
  `]
})
export class VisitorAdModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('adContainer') adContainerRef?: ElementRef<HTMLDivElement>;

  private readonly settingsService = inject(SettingsService);
  private readonly adCooldown = inject(AdCooldownService);
  private readonly adTriggerService = inject(AdTriggerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  isVisible = false;
  selectedAd: AdConfig | null = null;
  secondsRemaining = TOTAL_COUNTDOWN_SECONDS;
  progressPercent = 100;
  isTabPaused = false;
  adCycle = 1;

  private timerInterval: any = null;
  private autoCloseTimeout: any = null;
  private settingsSub?: Subscription;
  private triggerSub?: Subscription;
  private scriptInjected = false;

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!this.isVisible || this.secondsRemaining <= 0) return;
    this.isTabPaused = document.hidden;
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    // Pre-load settings so they are ready when the trigger fires
    this.evaluateEligibility();
  }

  ngAfterViewInit(): void {
    if (this.isVisible && this.selectedAd) {
      this.injectAdScripts();
    }
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
    this.settingsSub?.unsubscribe();
    this.triggerSub?.unsubscribe();
    if (this.adContainerRef?.nativeElement) {
      this.adContainerRef.nativeElement.innerHTML = '';
    }
    try {
      const mScript = document.getElementById('monetag-multi-tag');
      mScript?.remove();
    } catch { /* silent */ }
  }

  /**
   * Returns true if the current route is an admin route (ads are never shown there).
   */
  private isAdminRoute(): boolean {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const routerUrl = (this.router.url || '').split('?')[0].split('#')[0];
    return path.startsWith('/admin') || routerUrl.startsWith('/admin');
  }

  /**
   * Subscribes to settings/ads and listens for the AdTriggerService event.
   * When a movie card is clicked, checks cooldown and admin flags before opening the modal.
   */
  private evaluateEligibility(): void {
    // Cache the latest settings & ads so they are available immediately when triggered
    this.settingsSub = combineLatest([
      this.settingsService.settings$,
      this.settingsService.ads$
    ]).subscribe(([settings, ads]) => {
      // Pick an active interstitial ad for use during the session
      const activeAds = (ads || []).filter(a => a.active && !!a.htmlCode?.trim());
      this.selectedAd = activeAds.find(a => a.position === 'visitor_interstitial')
        || activeAds.find(a => a.position === 'home_interstitial')
        || activeAds.find(a => a.position === 'player_bottom')
        || activeAds[0]
        || null;
    });

    // Listen for movie-click trigger events from any card in the app
    this.triggerSub = this.adTriggerService.adTrigger$.subscribe(() => {
      // Never show ads on admin routes
      if (this.isAdminRoute()) return;

      // Skip if modal is already open
      if (this.isVisible) return;

      // Check global admin toggle — use synchronous getter
      if (this.settingsService.settings.adsEnabled === false) {
        // Ads disabled globally — navigate directly to pending destination
        this.navigatePending();
        return;
      }

      // If cooldown is active, navigate directly without showing ad
      if (this.adCooldown.isCooldownActive()) {
        this.navigatePending();
        return;
      }

      // Show the modal and auto-start the 30s countdown
      this.openAdModal();
    });
  }

  private openAdModal(): void {
    this.isVisible = true;
    this.secondsRemaining = TOTAL_COUNTDOWN_SECONDS;
    this.progressPercent = 100;
    this.isTabPaused = false;
    this.adCycle = 1;
    this.scriptInjected = false;
    this.cdr.detectChanges();

    // Inject ads immediately
    setTimeout(() => {
      this.injectAdScripts();
    }, 100);

    // Auto-start countdown immediately — no user click needed
    this.startCountdown();
  }

  private startCountdown(): void {
    this.clearAllTimers();

    this.timerInterval = setInterval(() => {
      // Pause countdown if user leaves this tab / window
      if (typeof document !== 'undefined' && document.hidden) {
        if (!this.isTabPaused) {
          this.isTabPaused = true;
          this.cdr.detectChanges();
        }
        return; // Pause timer!
      } else if (this.isTabPaused) {
        this.isTabPaused = false;
        this.cdr.detectChanges();
      }

      if (this.secondsRemaining > 0) {
        this.secondsRemaining--;
        this.progressPercent = (this.secondsRemaining / TOTAL_COUNTDOWN_SECONDS) * 100;

        // Dynamically rotate ads every ~8 seconds to keep fresh impressions & revenue flowing
        if (this.secondsRemaining === 22 || this.secondsRemaining === 14 || this.secondsRemaining === 6) {
          this.rotateDynamicAd();
        }

        this.cdr.detectChanges();

        if (this.secondsRemaining === 0) {
          this.onCountdownFinished();
        }
      }
    }, 1000);
  }

  private rotateDynamicAd(): void {
    if (!this.adContainerRef?.nativeElement) return;
    this.adCycle++;
    const container = this.adContainerRef.nativeElement;

    // Smooth transition between dynamic rotations
    container.style.opacity = '0.35';
    setTimeout(() => {
      container.innerHTML = '';

      // Rotate between banners and native ad networks
      if (this.adCycle % 2 === 0) {
        this.injectAdsterraBanner(container);
        this.injectAdsterraBanner468(container);
      } else {
        this.injectAdsterraNative(container);
        this.injectAdsterraBanner(container);
      }

      container.style.opacity = '1';
      this.cdr.detectChanges();
    }, 300);
  }

  private onCountdownFinished(): void {
    this.clearAllTimers();
    this.secondsRemaining = 0;
    this.progressPercent = 0;

    // Save 24-hour cooldown BEFORE navigating so it persists through the reload
    this.adCooldown.startCooldown(24);
    this.cdr.detectChanges();

    // After 2s, navigate to the pending movie then do a clean reload
    // The reload wipes all injected ad scripts/iframes from the DOM.
    this.autoCloseTimeout = setTimeout(() => {
      this.navigateAndReload();
    }, 2000);
  }

  dismissAd(): void {
    // Ensure 24-hour cooldown is saved
    this.adCooldown.startCooldown(24);
    this.navigateAndReload();
  }

  /**
   * Navigate to the pending movie destination stored by the home component,
   * then force a clean page reload to wipe all injected ad DOM nodes.
   */
  private navigateAndReload(): void {
    try {
      const pending: string[] | undefined = (window as any).__pendingAdNav;
      if (pending && pending.length) {
        // Build the destination URL and do a hard redirect (not Angular routing)
        // so the page is fully reloaded and all ad scripts are purged.
        const dest = pending.join('/').replace(/\/+/g, '/').replace(/^\/\//, '/');
        window.location.href = dest;
      } else {
        // No pending destination — just reload current page cleanly
        window.location.href = '/';
      }
    } catch {
      window.location.reload();
    } finally {
      // Clear the pending nav to avoid re-use
      try { delete (window as any).__pendingAdNav; } catch { /* silent */ }
    }
  }

  /**
   * Navigate directly to the pending destination WITHOUT showing ads
   * (used when cooldown is active or ads are globally disabled).
   */
  private navigatePending(): void {
    try {
      const pending: string[] | undefined = (window as any).__pendingAdNav;
      if (pending && pending.length) {
        this.router.navigate(pending);
      }
    } catch { /* silent */ } finally {
      try { delete (window as any).__pendingAdNav; } catch { /* silent */ }
    }
  }

  private closeWithoutCooldown(): void {
    this.isVisible = false;
    this.isTabPaused = false;
    this.adCycle = 1;
    this.clearAllTimers();
    if (this.adContainerRef?.nativeElement) {
      this.adContainerRef.nativeElement.innerHTML = '';
    }
    try {
      const mScript = document.getElementById('monetag-multi-tag');
      mScript?.remove();
    } catch { /* silent */ }
    this.scriptInjected = false;
    this.cdr.detectChanges();
  }

  private clearAllTimers(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }
  }

  private injectAdScripts(): void {
    if (this.scriptInjected || !this.adContainerRef) return;
    const container = this.adContainerRef.nativeElement;
    if (!container) return;

    this.scriptInjected = true;
    container.innerHTML = '';

    // 1. Inject Monetag Multi-Tag for high-revenue impressions/push during the 30s session
    this.injectMonetagScript();

    // 2. Inject Adsterra Native 4:1 Banner
    this.injectAdsterraNative(container);

    // 3. Inject Adsterra 300x250 Banner
    this.injectAdsterraBanner(container);

    // 4. Inject custom ad code if configured by admin
    if (this.selectedAd?.htmlCode) {
      this.injectCustomHtml(container, this.selectedAd.htmlCode);
    }
  }

  private injectMonetagScript(): void {
    if (typeof document === 'undefined') return;
    try {
      if (document.getElementById('monetag-multi-tag')) return;
      const script = document.createElement('script');
      script.id = 'monetag-multi-tag';
      script.src = 'https://quge5.com/88/tag.min.js';
      script.setAttribute('data-zone', '281040');
      script.setAttribute('data-cfasync', 'false');
      script.async = true;
      document.body.appendChild(script);
    } catch { /* silent */ }
  }

  private injectAdsterraNative(container: HTMLElement): void {
    try {
      const nativeWrap = document.createElement('div');
      nativeWrap.className = 'adsterra-native-wrap';

      const adDiv = document.createElement('div');
      adDiv.id = 'container-c9d044db823126693c8fc419ad62d580';
      nativeWrap.appendChild(adDiv);

      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = 'https://pl31354136.profitableratecpmnetwork.com/c9d044db823126693c8fc419ad62d580/invoke.js';
      nativeWrap.appendChild(script);

      container.appendChild(nativeWrap);
    } catch { /* silent */ }
  }

  private injectAdsterraBanner(container: HTMLElement): void {
    try {
      const bannerWrap = document.createElement('div');
      bannerWrap.className = 'adsterra-banner-wrap';

      const configScript = document.createElement('script');
      configScript.type = 'text/javascript';
      configScript.text = `
        atOptions = {
          'key' : '2426537576803ba068d26c2c79fd4ecf',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300,
          'params' : {}
        };
      `;
      bannerWrap.appendChild(configScript);

      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.src = 'https://www.highrevenueformat.com/2426537576803ba068d26c2c79fd4ecf/invoke.js';
      bannerWrap.appendChild(invokeScript);

      container.appendChild(bannerWrap);
    } catch { /* silent */ }
  }

  private injectAdsterraBanner468(container: HTMLElement): void {
    try {
      const bannerWrap = document.createElement('div');
      bannerWrap.className = 'adsterra-banner-wrap-468';

      const configScript = document.createElement('script');
      configScript.type = 'text/javascript';
      configScript.text = `
        atOptions = {
          'key' : '4876cfcbdd579b29cb1fba6db2aa93e7',
          'format' : 'iframe',
          'height' : 60,
          'width' : 468,
          'params' : {}
        };
      `;
      bannerWrap.appendChild(configScript);

      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.src = 'https://www.highrevenueformat.com/4876cfcbdd579b29cb1fba6db2aa93e7/invoke.js';
      bannerWrap.appendChild(invokeScript);

      container.appendChild(bannerWrap);
    } catch { /* silent */ }
  }

  private injectCustomHtml(container: HTMLElement, htmlCode: string): void {
    try {
      const template = document.createElement('template');
      template.innerHTML = htmlCode.trim();

      const nodes = Array.from(template.content.childNodes);
      for (const node of nodes) {
        if (node.nodeName === 'SCRIPT') {
          const orig = node as HTMLScriptElement;
          const script = document.createElement('script');
          Array.from(orig.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
          script.text = orig.text || orig.innerHTML;
          container.appendChild(script);
        } else {
          container.appendChild(document.importNode(node, true));
        }
      }
    } catch { /* silent */ }
  }
}

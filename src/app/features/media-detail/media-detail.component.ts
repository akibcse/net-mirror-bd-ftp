import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MovieService } from '../../services/movie.service';
import { SeoService } from '../../services/seo.service';
import { UserActivityService } from '../../services/user-activity.service';
import { AuthService } from '../../services/auth.service';
import { MediaDetails, MediaItem, MediaType, UserReview } from '../../models/media.model';

@Component({
  selector: 'app-media-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="detail-page" *ngIf="media(); else loadingTpl">
      <!-- BACKDROP HERO -->
      <div class="backdrop-hero" [style.background-image]="'url(' + getBackdropUrl(media()?.backdrop_path) + ')'">
        <div class="hero-overlay"></div>
        <div class="hero-container">
          <!-- BREADCRUMBS -->
          <div class="breadcrumbs">
            <a routerLink="/">Home</a>
            <span>›</span>
            <a [routerLink]="mediaType === 'movie' ? '/movies' : '/tv'">{{ mediaType === 'movie' ? 'Movies' : 'TV Series' }}</a>
            <span>›</span>
            <span class="current">{{ getTitle() }}</span>
          </div>

          <div class="hero-content">
            <!-- POSTER -->
            <div class="poster-wrap">
              <img
                [src]="getPosterUrl(media()?.poster_path)"
                [alt]="getTitle()"
                class="poster-img"
                (error)="onImgError($event)"
              />
              <div class="poster-badge" *ngIf="media()?.vote_average">
                ⭐ {{ media()?.vote_average | number:'1.1-1' }}
                <span class="votes-count">({{ media()?.vote_count | number }} votes)</span>
              </div>
            </div>

            <!-- DETAILS -->
            <div class="info-wrap">
              <div class="header-tags">
                <span class="type-pill">{{ mediaType === 'movie' ? 'Movie' : 'TV Series' }}</span>
                <span class="status-pill" *ngIf="media()?.status">{{ media()?.status }}</span>
                <span class="hd-pill">Ultra HD 4K</span>
              </div>

              <h1 class="media-title">{{ getTitle() }}</h1>
              <p class="tagline" *ngIf="media()?.tagline">"{{ media()?.tagline }}"</p>

              <!-- META BAR -->
              <div class="meta-row">
                <div class="meta-chip">
                  <span class="icon">📅</span>
                  <span>{{ getYear() }}</span>
                </div>
                <div class="meta-chip" *ngIf="getRuntime()">
                  <span class="icon">⏱️</span>
                  <span>{{ getRuntime() }}</span>
                </div>
                <div class="meta-chip" *ngIf="media()?.original_language">
                  <span class="icon">🌐</span>
                  <span>{{ media()?.original_language | uppercase }}</span>
                </div>
                <div class="meta-chip" *ngIf="media()?.number_of_seasons">
                  <span class="icon">📺</span>
                  <span>{{ media()?.number_of_seasons }} Season{{ (media()?.number_of_seasons || 1) > 1 ? 's' : '' }}</span>
                </div>
              </div>

              <!-- GENRES -->
              <div class="genre-pills" *ngIf="media()?.genres">
                <a
                  *ngFor="let g of media()?.genres"
                  [routerLink]="['/genre', mediaType, g.id, g.name]"
                  class="genre-pill"
                >
                  {{ g.name }}
                </a>
              </div>

              <!-- OVERVIEW / SYNOPSIS -->
              <div class="synopsis-box">
                <h3>Storyline</h3>
                <p>{{ media()?.overview || 'No synopsis available for this title.' }}</p>
              </div>

              <!-- ACTION BUTTONS -->
              <div class="action-buttons">
                <a [routerLink]="['/' + mediaType, media()?.id, 'watch']" class="btn-watch" (click)="onPlayClick()">
                  <span class="icon-play">▶</span>
                  <span>Watch Now</span>
                </a>

                <button class="btn-action" *ngIf="trailerKey" (click)="showTrailerModal = true">
                  <span>🎬</span> Trailer
                </button>

                <button
                  class="btn-action"
                  [class.active]="isInWatchlist()"
                  (click)="toggleWatchlist()"
                >
                  <span>{{ isInWatchlist() ? '✓' : '+' }}</span>
                  {{ isInWatchlist() ? 'In Watchlist' : 'Watchlist' }}
                </button>

                <button
                  class="btn-action"
                  [class.active]="isInFavorites()"
                  (click)="toggleFavorite()"
                >
                  <span>{{ isInFavorites() ? '❤️' : '🤍' }}</span>
                  {{ isInFavorites() ? 'Favorited' : 'Favorite' }}
                </button>

                <button class="btn-action" (click)="openShare()">
                  <span>🔗</span> Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT TABS / SECTIONS -->
      <div class="content-container">
        <div class="detail-grid">
          <!-- LEFT / MAIN COLUMN -->
          <div class="main-column">
            <!-- CAST CAROUSEL -->
            <section class="content-section" *ngIf="cast.length > 0">
              <h2 class="section-title">Top Cast</h2>
              <div class="cast-row">
                <div
                  *ngFor="let member of cast"
                  class="cast-card"
                  [routerLink]="['/person', member.id]"
                >
                  <div class="cast-img">
                    <img
                      [src]="getProfileUrl(member.profile_path)"
                      [alt]="member.name"
                      loading="lazy"
                      (error)="onImgError($event)"
                    />
                  </div>
                  <div class="cast-name">{{ member.name }}</div>
                  <div class="cast-char">{{ member.character }}</div>
                </div>
              </div>
            </section>

            <!-- SIMILAR & RECOMMENDATIONS -->
            <section class="content-section" *ngIf="recommendations.length > 0">
              <h2 class="section-title">You May Also Like</h2>
              <div class="recommendations-grid">
                <div
                  *ngFor="let rec of recommendations"
                  class="rec-card"
                  [routerLink]="['/' + (rec.media_type || mediaType), rec.id]"
                >
                  <div class="rec-poster">
                    <img
                      [src]="getPosterUrl(rec.poster_path)"
                      [alt]="rec.title || rec.name"
                      loading="lazy"
                      (error)="onImgError($event)"
                    />
                    <div class="rec-rating" *ngIf="rec.vote_average">
                      ⭐ {{ rec.vote_average | number:'1.1-1' }}
                    </div>
                  </div>
                  <div class="rec-title">{{ rec.title || rec.name }}</div>
                </div>
              </div>
            </section>

            <!-- REVIEWS SECTION -->
            <section class="content-section reviews-section">
              <div class="section-header-flex">
                <h2 class="section-title">Community Reviews ({{ reviews().length }})</h2>
                <button
                  class="btn-write-review"
                  *ngIf="!showReviewForm"
                  (click)="showReviewForm = true"
                >
                  ✍️ Write a Review
                </button>
              </div>

              <!-- REVIEW FORM -->
              <div class="review-form-card" *ngIf="showReviewForm">
                <h3>Your Review</h3>
                <div class="rating-input">
                  <span class="rating-label">Rating:</span>
                  <div class="star-picker">
                    <button
                      type="button"
                      *ngFor="let s of [1,2,3,4,5,6,7,8,9,10]"
                      (click)="newReviewRating = s"
                      [class.active]="s <= newReviewRating"
                    >★</button>
                  </div>
                  <span class="rating-num">{{ newReviewRating }}/10</span>
                </div>

                <textarea
                  [(ngModel)]="newReviewContent"
                  placeholder="What did you think of this title? (Avoid spoilers)"
                  rows="4"
                  class="form-control"
                ></textarea>

                <div class="form-actions">
                  <button class="btn-cancel" (click)="showReviewForm = false">Cancel</button>
                  <button
                    class="btn-submit-review"
                    [disabled]="!newReviewContent.trim() || isSubmittingReview"
                    (click)="submitReview()"
                  >
                    {{ isSubmittingReview ? 'Submitting...' : 'Post Review' }}
                  </button>
                </div>
              </div>

              <!-- REVIEWS LIST -->
              <div class="reviews-list" *ngIf="reviews().length > 0">
                <div *ngFor="let rev of reviews()" class="review-item">
                  <div class="review-header">
                    <div class="rev-user">
                      <div class="user-avatar">{{ rev.userName.charAt(0).toUpperCase() }}</div>
                      <div>
                        <div class="rev-name">{{ rev.userName }}</div>
                        <div class="rev-date">{{ rev.createdAt | date:'mediumDate' }}</div>
                      </div>
                    </div>
                    <div class="rev-score">⭐ {{ rev.rating }}/10</div>
                  </div>
                  <p class="rev-content">{{ rev.content }}</p>
                </div>
              </div>

              <div class="empty-reviews" *ngIf="reviews().length === 0 && !showReviewForm">
                <p>No community reviews yet. Be the first to share your thoughts!</p>
              </div>
            </section>
          </div>

          <!-- RIGHT / SIDEBAR COLUMN -->
          <div class="side-column">
            <div class="info-card">
              <h3>Media Details</h3>

              <div class="side-item" *ngIf="media()?.status">
                <span class="lbl">Status</span>
                <span class="val">{{ media()?.status }}</span>
              </div>

              <div class="side-item" *ngIf="media()?.release_date || media()?.first_air_date">
                <span class="lbl">Original Release</span>
                <span class="val">{{ (media()?.release_date || media()?.first_air_date) | date:'longDate' }}</span>
              </div>

              <div class="side-item" *ngIf="media()?.budget">
                <span class="lbl">Budget</span>
                <span class="val">{{ media()?.budget | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>

              <div class="side-item" *ngIf="media()?.revenue">
                <span class="lbl">Revenue</span>
                <span class="val">{{ media()?.revenue | currency:'USD':'symbol':'1.0-0' }}</span>
              </div>

              <div class="side-item" *ngIf="directors.length > 0">
                <span class="lbl">Director</span>
                <span class="val">
                  <a
                    *ngFor="let d of directors"
                    [routerLink]="['/person', d.id]"
                    class="person-link"
                  >
                    {{ d.name }}
                  </a>
                </span>
              </div>

              <div class="side-item" *ngIf="media()?.production_companies?.length">
                <span class="lbl">Production</span>
                <span class="val">{{ getCompanies() }}</span>
              </div>

              <div class="side-item" *ngIf="media()?.production_countries?.length">
                <span class="lbl">Country</span>
                <span class="val">{{ getCountries() }}</span>
              </div>

              <div class="side-item" *ngIf="media()?.spoken_languages?.length">
                <span class="lbl">Languages</span>
                <span class="val">{{ getLanguages() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TRAILER MODAL -->
      <div class="modal-backdrop" *ngIf="showTrailerModal" (click)="showTrailerModal = false">
        <div class="trailer-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ getTitle() }} — Official Trailer</h3>
            <button class="btn-close" (click)="showTrailerModal = false">✕</button>
          </div>
          <div class="video-wrapper">
            <iframe
              [src]="trailerUrl"
              allowfullscreen
              allow="autoplay; encrypted-media"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- SHARE MODAL -->
      <div class="modal-backdrop" *ngIf="showShareModal" (click)="showShareModal = false">
        <div class="share-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Share This Title</h3>
            <button class="btn-close" (click)="showShareModal = false">✕</button>
          </div>
          <div class="share-options">
            <button class="share-btn twitter" (click)="shareTo('twitter')">Twitter / X</button>
            <button class="share-btn facebook" (click)="shareTo('facebook')">Facebook</button>
            <button class="share-btn whatsapp" (click)="shareTo('whatsapp')">WhatsApp</button>
            <button class="share-btn telegram" (click)="shareTo('telegram')">Telegram</button>
          </div>
          <div class="copy-box">
            <input type="text" [value]="shareUrl" readonly class="share-input" #urlInput />
            <button class="btn-copy" (click)="copyLink(urlInput)">
              {{ copied ? 'Copied!' : 'Copy Link' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading title details...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: clip;
    }
    .detail-page {
      background: #0b0e14;
      color: #ffffff;
      min-height: 100vh;
      padding-bottom: 5rem;
      width: 100%;
      max-width: 100%;
      overflow-x: clip;
      box-sizing: border-box;
    }
    .backdrop-hero {
      position: relative;
      background-size: cover;
      background-position: center top;
      padding: clamp(1.25rem, 3vw, 2.5rem) clamp(1rem, 3vw, 1.5rem) clamp(2.5rem, 5vw, 4rem);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(11, 14, 20, 0.7) 0%, rgba(11, 14, 20, 0.95) 80%, #0b0e14 100%),
                  radial-gradient(circle at 20% 40%, rgba(99, 102, 241, 0.2) 0%, transparent 60%);
    }
    .hero-container {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
      min-width: 0;
      box-sizing: border-box;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #94a3b8;
      font-size: clamp(0.78rem, 2vw, 0.85rem);
      margin-bottom: clamp(1rem, 2.5vw, 2rem);
      flex-wrap: wrap;
      word-break: break-word;
      min-width: 0;
    }
    .breadcrumbs a {
      color: #cbd5e1;
      text-decoration: none;
      white-space: nowrap;
    }
    .breadcrumbs a:hover { color: #a855f7; }
    .breadcrumbs .current {
      color: #e2e8f0;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
      white-space: nowrap;
    }
    .hero-content {
      display: grid;
      grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
      gap: clamp(1.5rem, 3.5vw, 3rem);
      align-items: flex-start;
      min-width: 0;
      width: 100%;
    }
    @media (max-width: 900px) {
      .hero-content {
        grid-template-columns: minmax(0, 1fr);
        gap: 1.75rem;
      }
      .poster-wrap {
        max-width: 220px;
        margin: 0 auto;
      }
    }
    .poster-wrap {
      position: relative;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 20px 45px rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      aspect-ratio: 2/3;
      background: #1e293b;
      width: 100%;
      max-width: 100%;
    }
    .poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .poster-badge {
      position: absolute;
      bottom: 0;
      inset-inline: 0;
      background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 100%);
      padding: 1.5rem 1rem 0.85rem;
      font-size: 1.1rem;
      font-weight: 800;
      color: #fbbf24;
      text-align: center;
    }
    .votes-count {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: normal;
      margin-left: 0.35rem;
    }
    .info-wrap {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-width: 0;
      max-width: 100%;
      overflow-wrap: break-word;
    }
    .header-tags {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .type-pill, .status-pill, .hd-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.28rem 0.7rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .type-pill {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
    }
    .status-pill {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .hd-pill {
      background: rgba(234, 179, 8, 0.15);
      color: #facc15;
      border: 1px solid rgba(234, 179, 8, 0.3);
    }
    .media-title {
      font-size: clamp(1.8rem, 5vw, 3.8rem);
      font-weight: 900;
      color: #ffffff;
      line-height: 1.15;
      letter-spacing: -0.02em;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0;
    }
    .tagline {
      font-size: clamp(0.95rem, 2vw, 1.1rem);
      color: #94a3b8;
      font-style: italic;
      word-break: break-word;
      margin: 0;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.75rem 1.25rem;
      flex-wrap: wrap;
      min-width: 0;
    }
    .meta-chip {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: #cbd5e1;
      font-size: 0.9rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .genre-pills {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      min-width: 0;
    }
    .genre-pill {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #e2e8f0;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      font-size: 0.82rem;
      text-decoration: none;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .genre-pill:hover {
      background: #6366f1;
      border-color: #6366f1;
      color: white;
    }
    .synopsis-box h3 {
      font-size: 1.1rem;
      color: #ffffff;
      margin: 0 0 0.5rem;
    }
    .synopsis-box p {
      color: #cbd5e1;
      line-height: 1.7;
      font-size: 0.98rem;
      max-width: 900px;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .action-buttons {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
      width: 100%;
    }
    .btn-watch {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      font-size: 1.05rem;
      font-weight: 700;
      padding: 0.85rem 2rem;
      border-radius: 14px;
      text-decoration: none;
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45);
      transition: all 0.25s ease;
      cursor: pointer;
    }
    .btn-watch:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(99, 102, 241, 0.6);
    }
    .icon-play { font-size: 1.2rem; }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      padding: 0.8rem 1.25rem;
      border-radius: 14px;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-action:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-2px);
    }
    .btn-action.active {
      background: rgba(168, 85, 247, 0.25);
      border-color: #a855f7;
      color: #d8b4fe;
    }
    @media (max-width: 640px) {
      .action-buttons {
        gap: 0.5rem;
      }
      .btn-watch {
        width: 100%;
        justify-content: center;
        padding: 0.9rem 1.5rem;
        font-size: 1.05rem;
      }
      .btn-action {
        flex: 1 1 calc(50% - 0.35rem);
        justify-content: center;
        padding: 0.75rem 0.75rem;
        font-size: 0.85rem;
      }
    }
    @media (max-width: 380px) {
      .btn-action {
        flex: 1 1 100%;
      }
    }

    .content-container {
      width: 100%;
      max-width: 1440px;
      margin: 2rem auto 0;
      padding: 0 clamp(1rem, 3vw, 1.5rem);
      box-sizing: border-box;
      min-width: 0;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: clamp(1.5rem, 3vw, 3rem);
      min-width: 0;
      width: 100%;
    }
    @media (max-width: 1024px) {
      .detail-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .main-column {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .side-column {
      min-width: 0;
      max-width: 100%;
    }
    .content-section {
      margin-bottom: 3.5rem;
      min-width: 0;
      max-width: 100%;
    }
    .section-title {
      font-size: clamp(1.2rem, 3vw, 1.5rem);
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 1.25rem;
      border-left: 4px solid #6366f1;
      padding-left: 0.75rem;
    }
    .cast-row {
      display: flex;
      gap: 1.25rem;
      overflow-x: auto;
      width: 100%;
      max-width: 100%;
      padding-bottom: 1rem;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
    }
    .cast-card {
      min-width: 120px;
      max-width: 120px;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .cast-card:hover { transform: translateY(-4px); }
    .cast-img {
      width: 100%;
      aspect-ratio: 1/1;
      border-radius: 50%;
      overflow: hidden;
      background: #1e293b;
      margin-bottom: 0.6rem;
      border: 2px solid rgba(255,255,255,0.1);
    }
    .cast-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cast-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #ffffff;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cast-char {
      font-size: 0.75rem;
      color: #94a3b8;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .recommendations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 1rem;
      min-width: 0;
    }
    @media (max-width: 520px) {
      .recommendations-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
    }
    .rec-card {
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: transform 0.2s;
      min-width: 0;
    }
    .rec-card:hover { transform: translateY(-4px); }
    .rec-poster {
      position: relative;
      aspect-ratio: 2/3;
      border-radius: 10px;
      overflow: hidden;
      background: #1e293b;
      margin-bottom: 0.5rem;
      width: 100%;
    }
    .rec-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .rec-rating {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(0,0,0,0.8);
      color: #fbbf24;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .rec-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .section-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .btn-write-review {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: #ffffff;
      padding: 0.5rem 1.1rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.88rem;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-write-review:hover {
      background: #6366f1;
      border-color: #6366f1;
    }
    .review-form-card {
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: clamp(1rem, 3vw, 1.5rem);
      margin-bottom: 2rem;
      min-width: 0;
    }
    .rating-input {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin: 1rem 0;
    }
    .star-picker {
      display: flex;
      flex-wrap: wrap;
    }
    .star-picker button {
      background: none;
      border: none;
      color: #475569;
      font-size: clamp(1.15rem, 3.5vw, 1.4rem);
      cursor: pointer;
      padding: 0 2px;
      transition: color 0.15s;
    }
    .star-picker button.active {
      color: #fbbf24;
    }
    .rating-num {
      font-weight: 700;
      color: #fbbf24;
    }
    .form-control {
      width: 100%;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: white;
      padding: 0.75rem 1rem;
      font-family: inherit;
      outline: none;
      resize: vertical;
      box-sizing: border-box;
    }
    .form-control:focus {
      border-color: #6366f1;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    .btn-cancel {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.5rem 1rem;
    }
    .btn-submit-review {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      color: white;
      padding: 0.6rem 1.4rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-width: 0;
    }
    .review-item {
      background: rgba(17, 24, 39, 0.6);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 1.25rem;
      min-width: 0;
      word-break: break-word;
    }
    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .rev-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .rev-name { font-weight: 600; color: #ffffff; font-size: 0.95rem; }
    .rev-date { font-size: 0.75rem; color: #64748b; }
    .rev-score { font-weight: 700; color: #fbbf24; white-space: nowrap; }
    .rev-content { color: #cbd5e1; line-height: 1.6; font-size: 0.95rem; word-break: break-word; }
    .empty-reviews {
      text-align: center;
      padding: 2.5rem;
      color: #64748b;
      background: rgba(255,255,255,0.02);
      border-radius: 12px;
    }
    .info-card {
      background: rgba(17, 24, 39, 0.75);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: clamp(1rem, 3vw, 1.5rem);
      position: sticky;
      top: 90px;
      min-width: 0;
    }
    @media (max-width: 1024px) {
      .info-card {
        position: static !important;
      }
    }
    .info-card h3 {
      font-size: 1.2rem;
      color: #ffffff;
      margin: 0 0 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .side-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
      min-width: 0;
      word-break: break-word;
    }
    .side-item .lbl {
      font-size: 0.8rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .side-item .val {
      font-size: 0.95rem;
      color: #e2e8f0;
      font-weight: 500;
      margin-top: 0.2rem;
      word-break: break-word;
    }
    .person-link {
      color: #a855f7;
      text-decoration: none;
      margin-right: 0.5rem;
    }
    .person-link:hover { text-decoration: underline; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      box-sizing: border-box;
    }
    .trailer-modal {
      width: min(900px, 96vw);
      background: #111827;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      box-sizing: border-box;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem clamp(1rem, 3vw, 1.5rem);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .modal-header h3 { margin: 0; font-size: clamp(0.95rem, 2.5vw, 1.1rem); color: #ffffff; word-break: break-word; }
    .btn-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0.25rem;
    }
    .video-wrapper {
      position: relative;
      aspect-ratio: 16/9;
      width: 100%;
    }
    .video-wrapper iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .share-modal {
      width: min(440px, 94vw);
      background: #111827;
      border-radius: 16px;
      padding: clamp(1rem, 3vw, 1.5rem);
      border: 1px solid rgba(255,255,255,0.1);
      box-sizing: border-box;
    }
    .share-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin: 1.25rem 0;
    }
    @media (max-width: 380px) {
      .share-options {
        grid-template-columns: 1fr;
      }
    }
    .share-btn {
      padding: 0.75rem;
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.88rem;
    }
    .share-btn.twitter { background: #1da1f2; }
    .share-btn.facebook { background: #1877f2; }
    .share-btn.whatsapp { background: #25d366; }
    .share-btn.telegram { background: #0088cc; }
    .copy-box {
      display: flex;
      gap: 0.5rem;
      min-width: 0;
    }
    .share-input {
      flex: 1;
      min-width: 0;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      color: #94a3b8;
      font-size: 0.82rem;
    }
    .btn-copy {
      background: #6366f1;
      border: none;
      color: white;
      padding: 0 1rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .loading-state {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class MediaDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly movieService = inject(MovieService);
  private readonly seoService = inject(SeoService);
  private readonly userActivity = inject(UserActivityService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly subs = new Subscription();

  mediaType: MediaType = 'movie';
  mediaId = 0;
  media = signal<MediaDetails | null>(null);
  cast: any[] = [];
  directors: any[] = [];
  recommendations: MediaItem[] = [];
  reviews = signal<UserReview[]>([]);

  trailerKey: string | null = null;
  trailerUrl: SafeResourceUrl | null = null;
  showTrailerModal = false;
  showShareModal = false;
  showReviewForm = false;
  newReviewRating = 8;
  newReviewContent = '';
  isSubmittingReview = false;
  copied = false;

  // Reactive signals for watchlist/favorites - subscribe to service observables
  isInWatchlist = signal<boolean>(false);
  isInFavorites = signal<boolean>(false);

  get shareUrl(): string {
    return window.location.href;
  }

  ngOnInit(): void {
    this.subs.add(
      this.route.url.subscribe(urlSegments => {
        const typeSegment = urlSegments[0]?.path;
        this.mediaType = typeSegment === 'tv' ? 'tv' : 'movie';
      })
    );

    this.subs.add(
      this.route.paramMap.subscribe(params => {
        const id = Number(params.get('id'));
        if (id) {
          this.mediaId = id;
          this.loadDetails(id);
          this.loadReviews(id);
          this.isInWatchlist.set(this.userActivity.isInWatchlist(id));
          this.isInFavorites.set(this.userActivity.isInFavorites(id));
        }
      })
    );

    // Subscribe to watchlist/favorites changes for reactive UI updates
    this.subs.add(
      this.userActivity.watchlist$.subscribe(list => {
        if (this.mediaId) {
          this.isInWatchlist.set(list.some(item => Number(item.id) === Number(this.mediaId)));
        }
      })
    );
    this.subs.add(
      this.userActivity.favorites$.subscribe(list => {
        if (this.mediaId) {
          this.isInFavorites.set(list.some(item => Number(item.id) === Number(this.mediaId)));
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private loadDetails(id: number): void {
    const fetch$ = this.mediaType === 'movie'
      ? this.movieService.getMovieDetails(id)
      : this.movieService.getTvDetails(id);

    fetch$.subscribe({
      next: data => {
        this.media.set(data);
        const title = data.title || data.name || 'Net Mirror BD';
        const overview = data.overview || '';
        const poster = this.getPosterUrl(data.poster_path);

        this.seoService.setMediaDetailMeta(
          `Watch ${title} Free Online — Net Mirror BD`,
          overview.slice(0, 160),
          poster,
          this.mediaType === 'movie' ? 'video.movie' : 'video.tv_show'
        );

        // Cast & Crew
        const credits = data.credits;
        if (credits) {
          this.cast = (credits.cast || []).slice(0, 15);
          this.directors = (credits.crew || []).filter(c => c.job === 'Director');
        }

        // Recommendations
        if (data.recommendations?.results) {
          this.recommendations = data.recommendations.results.slice(0, 8);
        } else if (data.similar?.results) {
          this.recommendations = data.similar.results.slice(0, 8);
        }

        // Trailer
        const videos = data.videos?.results || [];
        const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
        if (trailer?.key) {
          this.trailerKey = trailer.key;
          this.trailerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.youtube.com/embed/${trailer.key}?autoplay=1`
          );
        }
      }
    });
  }

  private loadReviews(mediaId: number): void {
    this.userActivity.getReviews(mediaId).subscribe(revs => {
      this.reviews.set(revs);
    });
  }

  async toggleWatchlist(): Promise<void> {
    const item = this.media();
    if (!item) return;
    const added = await this.userActivity.toggleWatchlist({
      id: item.id,
      mediaType: this.mediaType,
      media_type: this.mediaType,
      title: item.title || item.name || 'Untitled',
      name: item.name || item.title || 'Untitled',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || '',
      addedAt: Date.now()
    });
    this.isInWatchlist.set(added);
  }

  onPlayClick(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }

  async toggleFavorite(): Promise<void> {
    const item = this.media();
    if (!item) return;
    const added = await this.userActivity.toggleFavorite({
      id: item.id,
      mediaType: this.mediaType,
      media_type: this.mediaType,
      title: item.title || item.name || 'Untitled',
      name: item.name || item.title || 'Untitled',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || '',
      addedAt: Date.now()
    });
    this.isInFavorites.set(added);
  }

  async submitReview(): Promise<void> {
    if (!this.newReviewContent.trim()) return;
    this.isSubmittingReview = true;
    try {
      await this.userActivity.addReview(
        this.mediaId,
        this.mediaType,
        this.newReviewRating,
        this.newReviewContent.trim()
      );
      this.newReviewContent = '';
      this.showReviewForm = false;
    } finally {
      this.isSubmittingReview = false;
    }
  }

  openShare(): void {
    this.showShareModal = true;
    this.copied = false;
  }

  shareTo(platform: string): void {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(`Watch ${this.getTitle()} on Net Mirror BD!`);
    let shareLink = '';

    if (platform === 'twitter') shareLink = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
    else if (platform === 'facebook') shareLink = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    else if (platform === 'whatsapp') shareLink = `https://api.whatsapp.com/send?text=${title}%20${url}`;
    else if (platform === 'telegram') shareLink = `https://t.me/share/url?url=${url}&text=${title}`;

    if (shareLink) window.open(shareLink, '_blank', 'width=600,height=400');
  }

  copyLink(input: HTMLInputElement): void {
    navigator.clipboard.writeText(input.value);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2500);
  }

  getTitle(): string {
    return this.media()?.title || this.media()?.name || '';
  }

  getYear(): string {
    const d = this.media()?.release_date || this.media()?.first_air_date;
    return d ? new Date(d).getFullYear().toString() : '';
  }

  getRuntime(): string {
    const mins = this.media()?.runtime;
    if (!mins) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  getCompanies(): string {
    return (this.media()?.production_companies || []).map(c => c.name).slice(0, 3).join(', ');
  }

  getCountries(): string {
    return (this.media()?.production_countries || []).map(c => c.name).join(', ');
  }

  getLanguages(): string {
    return (this.media()?.spoken_languages || []).map(l => l.english_name || l.name).join(', ');
  }

  getPosterUrl(path: string | null | undefined): string {
    return this.movieService.getImageUrl(path || null, 'w500');
  }

  getBackdropUrl(path: string | null | undefined): string {
    return this.movieService.getImageUrl(path || null, 'original');
  }

  getProfileUrl(path: string | null | undefined): string {
    return this.movieService.getImageUrl(path || null, 'w185');
  }

  onImgError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Poster';
  }
}

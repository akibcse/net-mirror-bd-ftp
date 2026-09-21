import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, ViewChild, ElementRef, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MovieService } from '../../services/movie.service';
import { SeoService } from '../../services/seo.service';
import { MediaItem, MediaType } from '../../models/media.model';
import { Subject, takeUntil, catchError, of } from 'rxjs';

@Component({
  selector: 'app-genre-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="genre-container">
      <!-- HERO BANNER -->
      <div class="genre-banner">
        <div class="banner-gradient"></div>
        <div class="banner-content">
          <div class="breadcrumbs">
            <a routerLink="/">Home</a>
            <span>/</span>
            <a [routerLink]="mediaType() === 'movie' ? '/movies' : '/tv'">{{ mediaType() === 'movie' ? 'Movies' : 'TV Series' }}</a>
            <span>/</span>
            <span class="current">{{ genreName() }}</span>
          </div>

          <h1 class="genre-title">
            <span class="type-pill">{{ mediaType() === 'movie' ? 'Movie' : 'TV' }}</span>
            {{ genreName() }}
          </h1>
          <p class="genre-desc">
            Explore the finest selection of {{ genreName() }} {{ mediaType() === 'movie' ? 'movies' : 'television shows' }}. Stream in full HD with multiple server options.
          </p>
        </div>
      </div>

      <!-- CONTROLS & FILTER BAR -->
      <div class="filter-bar">
        <div class="filter-count">
          Showing <strong>{{ items().length }}</strong> titles
        </div>

        <div class="filter-actions">
          <div class="select-wrapper">
            <label>Sort By</label>
            <select [value]="sortBy()" (change)="onSortChange($event)">
              <option value="popularity.desc">🔥 Most Popular</option>
              <option value="vote_average.desc">⭐ Highest Rated</option>
              <option value="primary_release_date.desc">📅 Newest First</option>
              <option value="revenue.desc">💰 Box Office</option>
            </select>
          </div>

          <div class="select-wrapper">
            <label>Year</label>
            <select [value]="selectedYear() || ''" (change)="onYearChange($event)">
              <option value="">All Years</option>
              <option *ngFor="let y of years" [value]="y">{{ y }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- MEDIA GRID -->
      <div class="media-grid" *ngIf="!loading() && items().length > 0">
        <div *ngFor="let item of items()" class="media-card" [routerLink]="['/' + (item.media_type || mediaType()), item.id]">
          <div class="poster-box">
            <img
              [src]="getPosterUrl(item.poster_path)"
              [alt]="item.title || item.name || 'Poster'"
              loading="lazy"
              (error)="onImgError($event)"
            />
            <div class="rating-badge" *ngIf="item.vote_average">
              ⭐ {{ item.vote_average | number:'1.1-1' }}
            </div>
            <div class="card-overlay">
              <span class="play-btn">▶</span>
            </div>
          </div>
          <div class="card-info">
            <h3 class="card-title">{{ item.title || item.name }}</h3>
            <div class="card-meta">
              <span>{{ getYear(item.release_date || item.first_air_date) }}</span>
              <span class="badge-quality">HD</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SKELETON / LOADING -->
      <div class="media-grid" *ngIf="loading()">
        <div *ngFor="let n of [1,2,3,4,5,6,7,8,9,10,11,12]" class="skeleton-card">
          <div class="skeleton-poster"></div>
          <div class="skeleton-line title-line"></div>
          <div class="skeleton-line sub-line"></div>
        </div>
      </div>

      <!-- EMPTY STATE -->
      <div class="empty-state" *ngIf="!loading() && items().length === 0">
        <div class="empty-icon">🎬</div>
        <h3>No titles found</h3>
        <p>Try adjusting your filter options or browse other genres.</p>
      </div>

      <!-- Loading More Indicator -->
      <div class="loading-more-box" *ngIf="loadingMore()">
        <div class="mini-spinner"></div>
        <span>Loading more titles...</span>
      </div>

      <!-- Infinite Scroll Sentinel -->
      <div class="scroll-sentinel" #genreDetailScrollSentinel></div>
    </div>
  `,
  styles: [`
    .genre-container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 0 1.5rem 4rem;
    }
    .genre-banner {
      position: relative;
      margin: 1.5rem 0 2rem;
      border-radius: 20px;
      overflow: hidden;
      padding: 3.5rem 2.5rem;
      background: linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(17, 24, 39, 0.9) 100%),
                  radial-gradient(circle at 80% 20%, rgba(147, 51, 234, 0.3) 0%, transparent 60%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #94a3b8;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .breadcrumbs a {
      color: #cbd5e1;
      text-decoration: none;
      transition: color 0.2s;
    }
    .breadcrumbs a:hover {
      color: #a855f7;
    }
    .breadcrumbs .current {
      color: #c084fc;
      font-weight: 600;
    }
    .genre-title {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .type-pill {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.3rem 0.8rem;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border-radius: 20px;
      color: white;
      font-weight: 700;
    }
    .genre-desc {
      max-width: 650px;
      color: #cbd5e1;
      line-height: 1.6;
      font-size: 1.05rem;
    }
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .filter-count {
      color: #94a3b8;
      font-size: 0.95rem;
    }
    .filter-count strong {
      color: #ffffff;
    }
    .filter-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .select-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #94a3b8;
    }
    .select-wrapper select {
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 0.5rem 1rem;
      border-radius: 10px;
      outline: none;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .select-wrapper select option {
      background: #111827;
      color: white;
    }
    .media-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1.5rem;
    }
    @media (max-width: 640px) {
      .media-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
      }
    }
    .media-card {
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: transform 0.25s ease;
    }
    .media-card:hover {
      transform: translateY(-6px);
    }
    .poster-box {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 2/3;
      background: #1e293b;
      box-shadow: 0 8px 20px rgba(0,0,0,0.35);
    }
    .poster-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }
    .media-card:hover .poster-box img {
      transform: scale(1.05);
    }
    .rating-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      padding: 3px 7px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.2);
    }
    .card-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .media-card:hover .card-overlay {
      opacity: 1;
    }
    .play-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
      transform: scale(0.85);
      transition: transform 0.2s ease;
    }
    .media-card:hover .play-btn {
      transform: scale(1);
    }
    .card-info {
      padding: 0.65rem 0.2rem 0;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #94a3b8;
      font-size: 0.8rem;
    }
    .badge-quality {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .skeleton-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .skeleton-poster {
      aspect-ratio: 2/3;
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
    }
    .skeleton-line {
      height: 12px;
      background: #1e293b;
      border-radius: 6px;
    }
    .title-line { width: 85%; }
    .sub-line { width: 45%; }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .empty-state {
      text-align: center;
      padding: 4rem 1rem;
      color: #94a3b8;
    }
    .empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .load-more-wrap {
      text-align: center;
      margin-top: 3rem;
    }
    .btn-load-more {
      padding: 0.85rem 2.2rem;
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-load-more:hover:not(:disabled) {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border-color: transparent;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    .btn-load-more:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .loading-more-box {
      padding: 2rem 1rem;
      text-align: center;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    .loading-more-box .mini-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(99, 102, 241, 0.2);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: shimmer-spin 0.8s linear infinite;
    }
    @keyframes shimmer-spin { to { transform: rotate(360deg); } }
    .scroll-sentinel { height: 1px; width: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenreDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly movieService = inject(MovieService);
  private readonly seoService = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  private scrollObserver: IntersectionObserver | null = null;
  private sentinelConnected = false;
  private isLoadingMoreFlag = false;

  @ViewChild('genreDetailScrollSentinel') scrollSentinel?: ElementRef<HTMLElement>;

  mediaType = signal<MediaType>('movie');
  genreId = signal<number>(0);
  genreName = signal<string>('');
  items = signal<MediaItem[]>([]);
  loading = signal<boolean>(true);
  loadingMore = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  sortBy = signal<string>('popularity.desc');
  selectedYear = signal<number | null>(null);

  years: number[] = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const type = (params.get('type') as MediaType) || 'movie';
      const id = Number(params.get('id'));
      const name = params.get('name') || 'Genre';

      this.mediaType.set(type);
      this.genreId.set(id);
      this.genreName.set(name);
      this.currentPage.set(1);
      this.items.set([]);

      this.seoService.setMediaDetailMeta(
        `${name} ${type === 'movie' ? 'Movies' : 'TV Series'} — Watch Online Free`,
        `Watch the best ${name} ${type === 'movie' ? 'movies' : 'TV series'} in HD with multiple servers on Net Mirror BD.`
      );

      this.fetchTitles();
    });
  }

  ngAfterViewChecked(): void {
    if (this.scrollSentinel?.nativeElement && !this.sentinelConnected) {
      this.setupObserver();
      this.sentinelConnected = true;
    }
    if (!this.scrollSentinel?.nativeElement) {
      this.sentinelConnected = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scrollObserver?.disconnect();
  }

  private setupObserver(): void {
    this.scrollObserver?.disconnect();
    this.scrollObserver = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          this.loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    if (this.scrollSentinel?.nativeElement) {
      this.scrollObserver.observe(this.scrollSentinel.nativeElement);
    }
  }

  fetchTitles(): void {
    this.loading.set(true);
    this.movieService
      .discover(this.mediaType(), {
        genreId: this.genreId(),
        sortBy: this.sortBy(),
        year: this.selectedYear() || undefined,
        page: this.currentPage()
      })
      .subscribe({
        next: res => {
          this.items.set(res.results || []);
          this.totalPages.set(res.total_pages || 1);
          this.loading.set(false);
          this.isLoadingMoreFlag = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  loadMore(): void {
    if (this.currentPage() >= this.totalPages() || this.isLoadingMoreFlag) return;
    this.isLoadingMoreFlag = true;
    this.loadingMore.set(true);
    this.cdr.markForCheck();
    const nextPage = this.currentPage() + 1;

    this.movieService
      .discover(this.mediaType(), {
        genreId: this.genreId(),
        sortBy: this.sortBy(),
        year: this.selectedYear() || undefined,
        page: nextPage
      })
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of({ results: [] as MediaItem[], total_pages: this.totalPages(), page: nextPage, total_results: 0 }))
      )
      .subscribe({
        next: res => {
          const newItems = res.results || [];
          if (newItems.length > 0) {
            this.items.update(prev => [...prev, ...newItems]);
            this.currentPage.set(nextPage);
            this.totalPages.set(res.total_pages || this.totalPages());
          }
          this.isLoadingMoreFlag = false;
          this.loadingMore.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingMoreFlag = false;
          this.loadingMore.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  onSortChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.sortBy.set(val);
    this.currentPage.set(1);
    this.isLoadingMoreFlag = false;
    this.fetchTitles();
  }

  onYearChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedYear.set(val ? Number(val) : null);
    this.currentPage.set(1);
    this.isLoadingMoreFlag = false;
    this.fetchTitles();
  }

  getPosterUrl(path: string | null): string {
    return this.movieService.getImageUrl(path, 'w500');
  }

  getYear(dateStr?: string): string {
    return dateStr ? new Date(dateStr).getFullYear().toString() : '';
  }

  onImgError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Poster';
  }
}

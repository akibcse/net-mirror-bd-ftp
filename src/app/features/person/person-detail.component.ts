import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MovieService } from '../../services/movie.service';
import { SeoService } from '../../services/seo.service';
import { PersonDetails, MediaItem } from '../../models/media.model';

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="person-container" *ngIf="person(); else loadingTpl">
      <!-- HERO HEADER -->
      <div class="person-hero">
        <div class="profile-col">
          <div class="avatar-card">
            <img
              [src]="getProfileUrl(person()?.profile_path)"
              [alt]="person()?.name"
              (error)="onImgError($event)"
            />
          </div>
          <div class="meta-card">
            <h3>Personal Info</h3>
            <div class="meta-item" *ngIf="person()?.known_for_department">
              <span class="meta-label">Known For</span>
              <span class="meta-val">{{ person()?.known_for_department }}</span>
            </div>
            <div class="meta-item" *ngIf="person()?.birthday">
              <span class="meta-label">Born</span>
              <span class="meta-val">{{ formatDate(person()?.birthday) }}</span>
            </div>
            <div class="meta-item" *ngIf="person()?.place_of_birth">
              <span class="meta-label">Place of Birth</span>
              <span class="meta-val">{{ person()?.place_of_birth }}</span>
            </div>
            <div class="meta-item" *ngIf="person()?.popularity">
              <span class="meta-label">Popularity Score</span>
              <span class="meta-val">🔥 {{ person()?.popularity | number:'1.1-1' }}</span>
            </div>
          </div>
        </div>

        <div class="bio-col">
          <h1 class="person-name">{{ person()?.name }}</h1>
          <p class="known-for">{{ person()?.known_for_department }}</p>

          <div class="bio-section">
            <h2>Biography</h2>
            <p class="bio-text" [class.collapsed]="!bioExpanded && hasLongBio">
              {{ person()?.biography || 'No biography available for this person.' }}
            </p>
            <button
              *ngIf="hasLongBio"
              (click)="bioExpanded = !bioExpanded"
              class="btn-expand-bio"
            >
              {{ bioExpanded ? 'Show Less' : 'Read Full Biography' }}
            </button>
          </div>

          <!-- CREDITS / FILMOGRAPHY -->
          <div class="filmography-section">
            <div class="section-header">
              <h2>Known For & Credits</h2>
              <div class="tab-pills">
                <button
                  [class.active]="activeTab === 'all'"
                  (click)="activeTab = 'all'"
                >
                  All ({{ allCredits.length }})
                </button>
                <button
                  [class.active]="activeTab === 'movie'"
                  (click)="activeTab = 'movie'"
                >
                  Movies ({{ movieCredits.length }})
                </button>
                <button
                  [class.active]="activeTab === 'tv'"
                  (click)="activeTab = 'tv'"
                >
                  TV Series ({{ tvCredits.length }})
                </button>
              </div>
            </div>

            <div class="credits-grid">
              <div
                *ngFor="let item of filteredCredits"
                class="credit-card"
                [routerLink]="['/' + (item.media_type || 'movie'), item.id]"
              >
                <div class="credit-poster">
                  <img
                    [src]="getPosterUrl(item.poster_path)"
                    [alt]="item.title || item.name"
                    loading="lazy"
                    (error)="onPosterError($event)"
                  />
                  <div class="credit-rating" *ngIf="item.vote_average">
                    ⭐ {{ item.vote_average | number:'1.1-1' }}
                  </div>
                </div>
                <div class="credit-info">
                  <div class="credit-title">{{ item.title || item.name }}</div>
                  <div class="credit-role" *ngIf="item.character">as {{ item.character }}</div>
                  <div class="credit-year">{{ getYear(item.release_date || item.first_air_date) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading person profile...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .person-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem 5rem;
    }
    .person-hero {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 3rem;
    }
    @media (max-width: 900px) {
      .person-hero {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
    }
    .profile-col {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .avatar-card {
      border-radius: 20px;
      overflow: hidden;
      aspect-ratio: 2/3;
      background: #1e293b;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .avatar-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .meta-card {
      background: rgba(17, 24, 39, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.5rem;
    }
    .meta-card h3 {
      font-size: 1.1rem;
      color: #ffffff;
      margin: 0 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      margin-bottom: 0.85rem;
    }
    .meta-label {
      font-size: 0.8rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .meta-val {
      font-size: 0.95rem;
      color: #e2e8f0;
      font-weight: 500;
    }
    .person-name {
      font-size: clamp(2.2rem, 5vw, 3.5rem);
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 0.25rem;
    }
    .known-for {
      color: #a855f7;
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 1.5rem;
    }
    .bio-section {
      margin-bottom: 2.5rem;
    }
    .bio-section h2, .section-header h2 {
      font-size: 1.35rem;
      color: #ffffff;
      margin: 0 0 0.75rem;
    }
    .bio-text {
      color: #cbd5e1;
      line-height: 1.7;
      font-size: 1rem;
      white-space: pre-line;
    }
    .bio-text.collapsed {
      display: -webkit-box;
      -webkit-line-clamp: 5;
      line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .btn-expand-bio {
      background: none;
      border: none;
      color: #a855f7;
      font-weight: 600;
      cursor: pointer;
      padding: 0.5rem 0;
      font-size: 0.95rem;
    }
    .btn-expand-bio:hover {
      text-decoration: underline;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.85rem;
    }
    .tab-pills {
      display: flex;
      gap: 0.5rem;
    }
    .tab-pills button {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8;
      padding: 0.4rem 0.9rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .tab-pills button.active {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      border-color: transparent;
    }
    .credits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 1.25rem;
    }
    @media (max-width: 600px) {
      .credits-grid {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 0.85rem;
      }
    }
    .credit-card {
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .credit-card:hover {
      transform: translateY(-5px);
    }
    .credit-poster {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      aspect-ratio: 2/3;
      background: #1e293b;
    }
    .credit-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .credit-rating {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(0,0,0,0.8);
      color: #fbbf24;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .credit-info {
      padding: 0.5rem 0.2rem 0;
    }
    .credit-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .credit-role {
      font-size: 0.78rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .credit-year {
      font-size: 0.75rem;
      color: #64748b;
    }
    .loading-state {
      min-height: 50vh;
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
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class PersonDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly movieService = inject(MovieService);
  private readonly seoService = inject(SeoService);

  person = signal<PersonDetails | null>(null);
  allCredits: any[] = [];
  movieCredits: any[] = [];
  tvCredits: any[] = [];
  activeTab: 'all' | 'movie' | 'tv' = 'all';
  bioExpanded = false;

  get hasLongBio(): boolean {
    return (this.person()?.biography?.length || 0) > 400;
  }

  get filteredCredits(): any[] {
    if (this.activeTab === 'movie') return this.movieCredits;
    if (this.activeTab === 'tv') return this.tvCredits;
    return this.allCredits;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) this.loadPerson(id);
    });
  }

  private loadPerson(id: string): void {
    this.movieService.getPersonDetails(id).subscribe({
      next: data => {
        this.person.set(data);
        this.seoService.setMediaDetailMeta(
          `${data.name} — Biography, Movies & TV Shows`,
          `Explore movies and TV series starring or directed by ${data.name}. Stream online on Net Mirror BD.`
        );

        const cast = data.combined_credits?.cast || [];
        // Sort credits by popularity or release date
        const sorted = [...cast].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        this.allCredits = sorted;
        this.movieCredits = sorted.filter(c => c.media_type === 'movie');
        this.tvCredits = sorted.filter(c => c.media_type === 'tv');
      }
    });
  }

  getProfileUrl(path: string | null | undefined): string {
    return this.movieService.getImageUrl(path || null, 'w500');
  }

  getPosterUrl(path: string | null | undefined): string {
    return this.movieService.getImageUrl(path || null, 'w500');
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getYear(dateStr?: string): string {
    return dateStr ? new Date(dateStr).getFullYear().toString() : '';
  }

  onImgError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Photo';
  }

  onPosterError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Poster';
  }
}

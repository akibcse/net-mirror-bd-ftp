import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SettingsService } from './settings.service';

export interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'video.movie';
  canonical?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly settingsService = inject(SettingsService);

  private siteName = 'Net Mirror BD';
  private defaultTitle = 'Net Mirror BD — Watch Movies & TV Series Online Free in Full HD';
  private defaultDescription = 'Stream thousands of movies and TV series in HD for free. Multiple servers, subtitles, and more.';
  private defaultImage = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=630&fit=crop';
  private defaultKeywords = 'movies, stream, free movies, watch online, tv series, cinema, streaming hd';
  private siteUrl = 'https://netmirrorbd.vercel.app';
  private twitterHandle = '@netmirrorbd';

  constructor() {
    this.settingsService.settings$.subscribe(settings => {
      if (settings) {
        this.siteName = settings.siteName || this.siteName;
        this.siteUrl = settings.siteUrl || this.siteUrl;

        // SEO specifics
        const seo = (settings.seo || {}) as Record<string, string>;
        this.defaultTitle = seo['defaultTitle'] || settings.globalSeoTitle || `${this.siteName} — Watch Movies & TV Series Online Free`;
        this.defaultDescription = seo['defaultDescription'] || settings.globalSeoDescription || this.defaultDescription;
        this.defaultImage = seo['ogImage'] || settings.globalOgImage || this.defaultImage;
        this.defaultKeywords = seo['keywords'] || this.defaultKeywords;
        this.twitterHandle = seo['twitterHandle'] || this.twitterHandle;

        // Apply default tags if on default or landing page
        this.applyGlobalTags();
      }
    });
  }

  applyGlobalTags(): void {
    const currentTitle = this.titleService.getTitle();
    if (!currentTitle || currentTitle.includes('Net Mirror BD') || currentTitle.includes('movie-streaming-app')) {
      this.titleService.setTitle(this.defaultTitle);
    }
    this.meta.updateTag({ name: 'description', content: this.defaultDescription });
    this.meta.updateTag({ name: 'keywords', content: this.defaultKeywords });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });
    this.meta.updateTag({ name: 'twitter:creator', content: this.twitterHandle });
  }

  setPageMeta(config: SeoConfig): void {
    const title = config.title ? `${config.title} | ${this.siteName}` : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const image = config.image || this.defaultImage;
    const url = config.url || (typeof window !== 'undefined' ? window.location.href : this.siteUrl);

    // Basic
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    if (config.keywords || this.defaultKeywords) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords || this.defaultKeywords });
    }

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: config.type || 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    // Twitter
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    this.meta.updateTag({ name: 'twitter:creator', content: this.twitterHandle });

    // Canonical
    this.setCanonical(config.canonical || url);
  }

  setMediaDetailMeta(title: string, description?: string, image?: string, type?: string): void {
    this.setPageMeta({
      title,
      description,
      image,
      type: (type as any) || 'video.movie'
    });
  }

  setMovieMeta(movie: {
    title?: string; name?: string; overview: string;
    poster_path: string | null; release_date?: string; first_air_date?: string;
    vote_average: number; genres?: { name: string }[];
  }): void {
    const title = movie.title || movie.name || 'Movie';
    const year = (movie.release_date || movie.first_air_date || '').substring(0, 4);
    const genres = (movie.genres || []).map(g => g.name).join(', ');
    const image = movie.poster_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
      : this.defaultImage;

    this.setPageMeta({
      title: `${title} (${year})`,
      description: movie.overview || `Watch ${title} online for free on ${this.siteName}. Rating: ${movie.vote_average.toFixed(1)}/10`,
      keywords: `${title}, ${genres}, watch online, streaming, free, ${this.defaultKeywords}`,
      image,
      type: 'video.movie'
    });
  }

  setGenreMeta(genreName: string, type: 'movie' | 'tv'): void {
    const mediaLabel = type === 'tv' ? 'TV Series' : 'Movies';
    this.setPageMeta({
      title: `${genreName} ${mediaLabel}`,
      description: `Browse the best ${genreName.toLowerCase()} ${mediaLabel.toLowerCase()} on ${this.siteName}. Watch online for free.`,
      keywords: `${genreName} movies, ${genreName} series, watch online, streaming, ${this.defaultKeywords}`
    });
  }

  setPersonMeta(name: string, knownFor: string): void {
    this.setPageMeta({
      title: name,
      description: `${name} — ${knownFor}. Browse their filmography and watch their movies and TV shows on ${this.siteName}.`,
      keywords: `${name}, actor, director, filmography, movies, series, ${this.defaultKeywords}`
    });
  }

  injectMovieStructuredData(movie: any): void {
    const existing = this.document.getElementById('movie-structured-data');
    if (existing) existing.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': movie.seasons ? 'TVSeries' : 'Movie',
      name: movie.title || movie.name,
      description: movie.overview,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
      datePublished: movie.release_date || movie.first_air_date,
      aggregateRating: movie.vote_count > 0 ? {
        '@type': 'AggregateRating',
        ratingValue: movie.vote_average.toFixed(1),
        ratingCount: movie.vote_count,
        bestRating: '10',
        worstRating: '1'
      } : undefined,
      genre: (movie.genres || []).map((g: any) => g.name),
      director: movie.credits?.crew?.find((c: any) => c.job === 'Director')
        ? { '@type': 'Person', name: movie.credits.crew.find((c: any) => c.job === 'Director').name }
        : undefined
    };

    const script = this.document.createElement('script');
    script.id = 'movie-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    this.document.head.appendChild(script);
  }

  injectBreadcrumbStructuredData(items: { name: string; url: string }[]): void {
    const existing = this.document.getElementById('breadcrumb-structured-data');
    if (existing) existing.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url
      }))
    };

    const script = this.document.createElement('script');
    script.id = 'breadcrumb-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    this.document.head.appendChild(script);
  }

  injectOrganizationSchema(): void {
    const existing = this.document.getElementById('org-structured-data');
    if (existing) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.siteName,
      url: this.siteUrl,
      logo: `${this.siteUrl}/icons/icon-192x192.png`
    };

    const script = this.document.createElement('script');
    script.id = 'org-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    this.document.head.appendChild(script);
  }

  private setCanonical(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}

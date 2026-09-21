import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  MediaItem,
  MediaDetails,
  SeasonDetails,
  PersonDetails,
  PaginatedResponse,
  Genre,
  MediaType
} from '../models/media.model';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.tmdbBaseUrl;
  private readonly apiKey = environment.tmdbApiKey;
  private readonly imageBaseUrl = environment.tmdbImageBaseUrl;

  private getParams(extraParams: Record<string, string | number | boolean> = {}): HttpParams {
    let params = new HttpParams().set('api_key', this.apiKey);
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, value.toString());
      }
    }
    return params;
  }

  // ─── MOVIES ────────────────────────────────────────────────────────

  getTrendingMovies(timeWindow: 'day' | 'week' = 'week', page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/trending/movie/${timeWindow}`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  getPopularMovies(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/movie/popular`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  getTopRatedMovies(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/movie/top_rated`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  getUpcomingMovies(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/movie/upcoming`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  getNowPlayingMovies(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/movie/now_playing`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  getLatestMovie(): Observable<MediaItem> {
    return this.http.get<MediaItem>(`${this.baseUrl}/movie/latest`, { params: this.getParams() });
  }

  getMovieDetails(id: number | string): Observable<MediaDetails> {
    const params = this.getParams({
      append_to_response: 'credits,videos,recommendations,similar,external_ids,keywords'
    });
    return this.http.get<MediaDetails>(`${this.baseUrl}/movie/${id}`, { params });
  }

  getMovieKeywords(id: number | string): Observable<{ keywords: { id: number; name: string }[] }> {
    return this.http.get<any>(`${this.baseUrl}/movie/${id}/keywords`, { params: this.getParams() });
  }

  // ─── TV SERIES ─────────────────────────────────────────────────────

  getTrendingTv(timeWindow: 'day' | 'week' = 'week', page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/trending/tv/${timeWindow}`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  getPopularTv(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/tv/popular`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  getTopRatedTv(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/tv/top_rated`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  getOnAirTv(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/tv/on_the_air`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  getAiringTodayTv(page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/tv/airing_today`, { params: this.getParams({ page }) })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  getTvDetails(id: number | string): Observable<MediaDetails> {
    const params = this.getParams({
      append_to_response: 'credits,videos,recommendations,similar,external_ids,keywords'
    });
    return this.http.get<MediaDetails>(`${this.baseUrl}/tv/${id}`, { params });
  }

  getSeasonDetails(tvId: number | string, seasonNumber: number): Observable<SeasonDetails> {
    return this.http.get<SeasonDetails>(`${this.baseUrl}/tv/${tvId}/season/${seasonNumber}`, {
      params: this.getParams()
    });
  }

  getEpisodeDetails(tvId: number | string, season: number, episode: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/tv/${tvId}/season/${season}/episode/${episode}`, {
      params: this.getParams({ append_to_response: 'credits' })
    });
  }

  // ─── SEARCH ────────────────────────────────────────────────────────

  searchMulti(query: string, page = 1): Observable<PaginatedResponse<MediaItem>> {
    const params = this.getParams({ query, page, include_adult: false });
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/search/multi`, { params })
      .pipe(
        map(res => ({
          ...res,
          results: res.results.filter(
            item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
          )
        }))
      );
  }

  searchMovies(query: string, page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/search/movie`, {
        params: this.getParams({ query, page, include_adult: false })
      })
      .pipe(map(res => this.attachMediaType(res, 'movie')));
  }

  searchTv(query: string, page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/search/tv`, {
        params: this.getParams({ query, page, include_adult: false })
      })
      .pipe(map(res => this.attachMediaType(res, 'tv')));
  }

  searchPerson(query: string, page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/search/person`, {
      params: this.getParams({ query, page, include_adult: false })
    });
  }

  // ─── PERSON ────────────────────────────────────────────────────────

  getPersonDetails(id: number | string): Observable<PersonDetails> {
    return this.http.get<PersonDetails>(`${this.baseUrl}/person/${id}`, {
      params: this.getParams({ append_to_response: 'combined_credits,external_ids' })
    });
  }

  getPersonMovieCredits(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/person/${id}/movie_credits`, { params: this.getParams() });
  }

  getPersonTvCredits(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/person/${id}/tv_credits`, { params: this.getParams() });
  }

  getPopularPeople(page = 1): Observable<PaginatedResponse<any>> {
    return this.http.get<PaginatedResponse<any>>(`${this.baseUrl}/person/popular`, {
      params: this.getParams({ page })
    });
  }

  // ─── DISCOVER ──────────────────────────────────────────────────────

  discover(
    type: MediaType = 'movie',
    options: {
      genreId?: number;
      sortBy?: string;
      year?: number;
      page?: number;
      minRating?: number;
      maxRating?: number;
      language?: string;
      withPerson?: number;
    } = {}
  ): Observable<PaginatedResponse<MediaItem>> {
    const {
      genreId,
      sortBy = 'popularity.desc',
      year,
      page = 1,
      minRating,
      maxRating,
      language,
      withPerson
    } = options;

    const extra: Record<string, string | number> = {
      page,
      sort_by: sortBy,
      include_adult: 'false'
    };

    if (genreId) extra['with_genres'] = genreId;
    if (year) {
      if (type === 'movie') extra['primary_release_year'] = year;
      else extra['first_air_date_year'] = year;
    }
    if (minRating) extra['vote_average.gte'] = minRating;
    if (maxRating) extra['vote_average.lte'] = maxRating;
    if (language) extra['with_original_language'] = language;
    if (withPerson) extra['with_people'] = withPerson;

    return this.http
      .get<PaginatedResponse<MediaItem>>(`${this.baseUrl}/discover/${type}`, { params: this.getParams(extra) })
      .pipe(map(res => this.attachMediaType(res, type)));
  }

  // ─── GENRES ────────────────────────────────────────────────────────

  getGenres(type: MediaType = 'movie'): Observable<Genre[]> {
    return this.http
      .get<{ genres: Genre[] }>(`${this.baseUrl}/genre/${type}/list`, { params: this.getParams() })
      .pipe(map(res => res.genres), shareReplay(1));
  }

  getMoviesByGenre(genreId: number, page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.discover('movie', { genreId, page });
  }

  getTvByGenre(genreId: number, page = 1): Observable<PaginatedResponse<MediaItem>> {
    return this.discover('tv', { genreId, page });
  }

  // ─── TMDB IMPORT (for admin) ────────────────────────────────────────

  getMovieById(tmdbId: number | string): Observable<MediaDetails> {
    return this.getMovieDetails(tmdbId);
  }

  getTvById(tmdbId: number | string): Observable<MediaDetails> {
    return this.getTvDetails(tmdbId);
  }

  // ─── IMAGE UTILS ───────────────────────────────────────────────────

  getImageUrl(
    path: string | null,
    size: 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
  ): string {
    return path
      ? `${this.imageBaseUrl}/${size}${path}`
      : 'https://placehold.co/500x750/151a24/ffffff?text=No+Poster';
  }

  getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'original'): string {
    return path
      ? `${this.imageBaseUrl}/${size}${path}`
      : 'https://placehold.co/1280x720/151a24/ffffff?text=Net Mirror BD';
  }

  getProfileUrl(path: string | null): string {
    return path
      ? `${this.imageBaseUrl}/w185${path}`
      : 'https://placehold.co/185x278/1e2433/94a3b8?text=?';
  }

  getMediaTitle(item: MediaItem | MediaDetails): string {
    return item.title || item.name || 'Untitled';
  }

  getMediaDate(item: MediaItem | MediaDetails): string {
    return (item as MediaItem).release_date || (item as MediaItem).first_air_date || '';
  }

  getMediaYear(item: MediaItem | MediaDetails): string {
    const date = this.getMediaDate(item);
    return date ? new Date(date).getFullYear().toString() : '';
  }

  getRatingColor(rating: number): string {
    if (rating >= 7.5) return '#22c55e';
    if (rating >= 6) return '#f59e0b';
    if (rating >= 4) return '#f97316';
    return '#ef4444';
  }

  getDirector(details: MediaDetails): string {
    const crew = details.credits?.crew || [];
    const director = crew.find(c => c.job === 'Director');
    return director?.name || '';
  }

  private attachMediaType(
    res: PaginatedResponse<MediaItem>,
    type: MediaType
  ): PaginatedResponse<MediaItem> {
    return {
      ...res,
      results: (res.results || []).map(item => ({
        ...item,
        media_type: item.media_type || type
      }))
    };
  }
}

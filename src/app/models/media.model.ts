export type MediaType = 'movie' | 'tv';

// ─── TMDB Core Types ────────────────────────────────────────────────

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface SpokenLanguage {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  media_type?: MediaType;
  genre_ids?: number[];
  original_language?: string;
  popularity?: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface VideoTrailer {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at?: string;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episode_count: number;
  air_date: string;
}

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  runtime?: number;
  crew?: CrewMember[];
  guest_stars?: CastMember[];
}

export interface SeasonDetails extends Season {
  episodes: Episode[];
}

export interface ExternalIds {
  imdb_id: string | null;
  wikidata_id?: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  combined_credits?: {
    cast: (MediaItem & { character?: string; media_type: MediaType })[];
    crew: (MediaItem & { job?: string; media_type: MediaType })[];
  };
}

export interface Keyword {
  id: number;
  name: string;
}

export interface MediaDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  vote_average: number;
  vote_count: number;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Season[];
  genres: Genre[];
  tagline: string;
  status: string;
  homepage?: string;
  original_language?: string;
  spoken_languages?: SpokenLanguage[];
  production_countries?: ProductionCountry[];
  production_companies?: ProductionCompany[];
  popularity?: number;
  budget?: number;
  revenue?: number;
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
  videos?: {
    results: VideoTrailer[];
  };
  similar?: {
    results: MediaItem[];
  };
  recommendations?: {
    results: MediaItem[];
  };
  keywords?: {
    keywords?: Keyword[];
    results?: Keyword[];
  };
  external_ids?: ExternalIds;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  };
}

export interface PaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ─── User Activity Types ─────────────────────────────────────────────

export interface UserReview {
  id?: string;
  mediaId: number;
  mediaType: MediaType;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number;
  content: string;
  createdAt: number;
  approved?: boolean;
  reported?: boolean;
}

export interface WatchlistItem {
  id: number;
  mediaType?: MediaType;
  media_type?: MediaType;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  addedAt: number;
}

export interface WatchHistoryItem extends WatchlistItem {
  season?: number;
  episode?: number;
  watchedAt: number;
  progressSeconds?: number;
  durationSeconds?: number;
}

// ─── Streaming Servers ──────────────────────────────────────────────

export interface StreamServerConfig {
  id: string;
  name: string;
  priority: number;
  enabled?: boolean;
  active?: boolean;
  urlTemplate?: string;
  movieUrlTemplate?: string;
  tvUrlTemplate?: string;
  quality?: string;
  language?: string;
  subtitleUrl?: string;
  isDefault?: boolean;
  isBackup?: boolean;
  createdAt?: number;
}

// ─── Admin / CMS Types ──────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'admin' | 'editor' | 'moderator' | 'content_manager' | 'support';

export interface AdminPermissions {
  manageMovies: boolean;
  manageSeries: boolean;
  manageUsers: boolean;
  manageComments: boolean;
  manageSettings: boolean;
  manageAds: boolean;
  manageSeo: boolean;
  viewAnalytics: boolean;
  manageAdmins: boolean;
  manageLogs: boolean;
}

export const DEFAULT_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  super_admin:     { manageMovies: true, manageSeries: true, manageUsers: true, manageComments: true, manageSettings: true, manageAds: true, manageSeo: true, viewAnalytics: true, manageAdmins: true, manageLogs: true },
  admin:           { manageMovies: true, manageSeries: true, manageUsers: true, manageComments: true, manageSettings: true, manageAds: true, manageSeo: true, viewAnalytics: true, manageAdmins: false, manageLogs: true },
  editor:          { manageMovies: true, manageSeries: true, manageUsers: false, manageComments: true, manageSettings: false, manageAds: false, manageSeo: true, viewAnalytics: true, manageAdmins: false, manageLogs: false },
  moderator:       { manageMovies: false, manageSeries: false, manageUsers: false, manageComments: true, manageSettings: false, manageAds: false, manageSeo: false, viewAnalytics: false, manageAdmins: false, manageLogs: false },
  content_manager: { manageMovies: true, manageSeries: true, manageUsers: false, manageComments: false, manageSettings: false, manageAds: false, manageSeo: true, viewAnalytics: true, manageAdmins: false, manageLogs: false },
  support:         { manageMovies: false, manageSeries: false, manageUsers: true, manageComments: true, manageSettings: false, manageAds: false, manageSeo: false, viewAnalytics: false, manageAdmins: false, manageLogs: true }
};

export interface MediaOverride {
  id: string;
  mediaType: MediaType;
  title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  overview?: string;
  featured?: boolean;
  trending?: boolean;
  published?: boolean;
  draft?: boolean;
  ageRating?: string;
  customPoster?: string;
  customBackdrop?: string;
  customEmbedUrl?: string;
  customStreamServers?: StreamServerConfig[];
  addedAt?: number;
  addedBy?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  slug?: string;
}

export type AutoImportCategory = 'trending' | 'popular' | 'now_playing' | 'top_rated' | 'upcoming' | 'on_air' | 'airing_today' | 'all';
export type AutoImportMediaType = 'movie' | 'tv' | 'all';

export interface AutoImportOptions {
  category: AutoImportCategory;
  limit: number;
  mediaType?: AutoImportMediaType;
  skipExisting?: boolean;
  autoPublish?: boolean;
  markFeatured?: boolean;
  markTrending?: boolean;
}

export interface AutoImportProgress {
  current: number;
  total: number;
  title: string;
  posterPath?: string | null;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  message: string;
  logs: { title: string; status: 'success' | 'skipped' | 'error'; time: string }[];
}

export interface AutoSyncConfig {
  enabled: boolean;
  category: AutoImportCategory;
  limit: number;
  lastSyncTimestamp?: number;
  lastSyncCount?: number;
}

// ─── Site Settings ──────────────────────────────────────────────────

export interface SiteSettings {
  siteName: string;
  siteTagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  siteUrl?: string;
  contactEmail?: string;
  footerText?: string;
  copyrightText?: string;
  defaultLanguage?: string;
  defaultCountry?: string;
  timezone?: string;
  maintenanceMode?: boolean;
  registrationOpen?: boolean;
  announcement?: {
    enabled: boolean;
    message: string;
    type?: string;
  };
  seo?: Record<string, any>;
  twitterUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  tmdbApiKey?: string;
  cacheDurationMinutes?: number;
  globalSeoTitle?: string;
  globalSeoDescription?: string;
  globalOgImage?: string;
  robotsTxt?: string;
  adsEnabled?: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Net Mirror BDbd',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
  siteUrl: 'https://ott.akibhasan.online',
  contactEmail: 'roadyakib@gmail.com',
  footerText: 'MOVIES ANYTIME EVERYWHERE. The premier free streaming destination for full HD movies and television series.',
  copyrightText: '© 2026 Net Mirror BDbd. Developed by Md. Akib Hasan (roadyakib@gmail.com). All rights reserved.',
  defaultLanguage: 'en',
  defaultCountry: 'US',
  timezone: 'UTC',
  maintenanceMode: false,
  twitterUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  primaryColor: '#6366f1',
  secondaryColor: '#a855f7',
  customCss: '',
  tmdbApiKey: '',
  cacheDurationMinutes: 60,
  globalSeoTitle: 'Net Mirror BD — Watch Movies & TV Series',
  globalSeoDescription: 'Stream thousands of movies and TV series in HD. Free online streaming with multiple servers.',
  globalOgImage: '',
  robotsTxt: 'User-agent: *\nAllow: /',
  adsEnabled: true
};

// ─── Ads ────────────────────────────────────────────────────────────

export type AdPlacement = 'header_banner' | 'sidebar' | 'pre_roll' | 'post_roll' | 'popup' | 'footer';

export interface Advertisement {
  id: string;
  name: string;
  placement: AdPlacement;
  code: string;
  enabled: boolean;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  startDate?: number;
  endDate?: number;
  createdAt: number;
}

export interface AdConfig {
  id: string;
  name: string;
  position: string;
  htmlCode: string;
  active: boolean;
  notes?: string;
}

// ─── Notifications ───────────────────────────────────────────────────

export type NotificationType = 'release' | 'new_movie' | 'new_episode' | 'system' | 'promo' | 'review_approved';

export interface AppNotification {
  id?: string;
  type: NotificationType;
  title: string;
  message: string;
  imageUrl?: string;
  link?: string;
  read?: boolean;
  userId?: string;
  createdAt: number;
}

// ─── Analytics ───────────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  visitors: number;
  pageViews: number;
  watchEvents: number;
  searches: number;
  registrations: number;
}

export interface MediaAnalytics {
  mediaId: number;
  mediaType: MediaType;
  title: string;
  views: number;
  watchTime: number;
  lastViewed: number;
}

export interface SearchAnalytics {
  query: string;
  count: number;
  lastSearched: number;
}

// ─── Logs ────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error';

export interface AdminLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  action: string;
  target?: string;
  details?: string;
  timestamp: number;
  level: LogLevel;
  ip?: string;
  location?: string;
  isp?: string;
  device?: string;
}

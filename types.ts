export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  WATCHLIST = 'WATCHLIST',
  RATED = 'RATED',
  SEARCH = 'SEARCH',
  SETTINGS = 'SETTINGS'
}

export enum SortOption {
  DATE_DESC = 'DATE_DESC',   // Mais recentes primeiro
  DATE_ASC = 'DATE_ASC',     // Mais antigos primeiro
  YEAR_DESC = 'YEAR_DESC',   // Lançamento mais novo
  YEAR_ASC = 'YEAR_ASC',     // Lançamento mais antigo
  TITLE_ASC = 'TITLE_ASC',   // A-Z
  RATING_DESC = 'RATING_DESC' // Melhor avaliados (apenas para Rated)
}

export type StreamingPlatform = 'Netflix' | 'Prime' | 'Disney+' | 'HBO' | 'AppleTV' | 'Cinema' | 'Outros' | null;

export interface Movie {
  id: string;
  tmdbId?: number; // ID oficial da TMDB
  title: string;
  year: string;
  genre: string[];
  description: string;
  imageUrl: string; // URL completo ou path da TMDB
  isWatched: boolean;
  rating?: number; // 1-5
  userReview?: string;
  addedAt: number;
  watchedAt?: number;
  // New Fields
  platform?: StreamingPlatform;
  pickedBy?: 'A' | 'B' | null; // A = User 1, B = User 2
  tags?: string[]; // Custom tags like "Sad", "Funny", "Date Night"
}

export interface SearchResult {
  tmdbId: number;
  title: string;
  year: string;
  genre: string[];
  description: string;
  posterPath: string | null;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
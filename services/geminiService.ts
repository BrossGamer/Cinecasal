import { SearchResult, Movie } from "../types";

const BASE_URL = "https://api.themoviedb.org/3";
const LANGUAGE = "pt-BR";

// Map TMDB Genre IDs to names
const GENRES: Record<number, string> = {
  28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
  99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia",
  36: "História", 27: "Terror", 10402: "Música", 9648: "Mistério",
  10749: "Romance", 878: "Ficção", 10770: "TV Movie", 53: "Thriller",
  10752: "Guerra", 37: "Faroeste"
};

const getGenreNames = (ids: number[]): string[] => {
  return ids.map(id => GENRES[id]).filter(Boolean).slice(0, 3);
};

export const searchMovies = async (query: string, apiKey: string): Promise<SearchResult[]> => {
  if (!apiKey) {
    console.error("TMDB API Key missing");
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=${LANGUAGE}&include_adult=false`
    );
    
    if (!response.ok) throw new Error("Falha na busca TMDB");
    
    const data = await response.json();
    
    return data.results.map((item: any) => ({
      tmdbId: item.id,
      title: item.title,
      year: item.release_date ? item.release_date.split('-')[0] : 'N/A',
      genre: getGenreNames(item.genre_ids || []),
      description: item.overview || "Sem sinopse disponível.",
      posterPath: item.poster_path
    })).filter((m: any) => m.posterPath); // Filtrar filmes sem capa para manter a estética

  } catch (error) {
    console.error("Erro na busca TMDB:", error);
    return [];
  }
};

export const getRecommendations = async (watchedMovies: Movie[], allMovies: Movie[], apiKey: string): Promise<SearchResult[]> => {
  if (!apiKey) return [];

  try {
    // Lógica: Pegar um filme aleatório que foi bem avaliado (>= 4 estrelas) para buscar similares
    const goodMovies = watchedMovies.filter(m => (m.rating || 0) >= 4 && m.tmdbId);
    
    // Se não tiver filmes bem avaliados, pega qualquer um da lista de assistidos
    const sourceList = goodMovies.length > 0 ? goodMovies : watchedMovies.filter(m => m.tmdbId);

    // Se ainda não tiver nada (lista vazia), retorna filmes populares
    if (sourceList.length === 0) {
      const response = await fetch(`${BASE_URL}/movie/popular?api_key=${apiKey}&language=${LANGUAGE}&page=1`);
      const data = await response.json();
      return mapResults(data.results, allMovies);
    }

    // Seleciona um filme "semente" aleatório
    const seedMovie = sourceList[Math.floor(Math.random() * sourceList.length)];
    
    const response = await fetch(
      `${BASE_URL}/movie/${seedMovie.tmdbId}/recommendations?api_key=${apiKey}&language=${LANGUAGE}&page=1`
    );
    
    const data = await response.json();
    return mapResults(data.results, allMovies);

  } catch (error) {
    console.error("Erro nas recomendações TMDB:", error);
    return [];
  }
};

const mapResults = (results: any[], existingMovies: Movie[]): SearchResult[] => {
  const existingIds = new Set(existingMovies.map(m => m.tmdbId));
  
  return results
    .filter((item: any) => !existingIds.has(item.id) && item.poster_path) // Remove duplicatas e sem poster
    .slice(0, 6) // Limita a 6 sugestões
    .map((item: any) => ({
      tmdbId: item.id,
      title: item.title,
      year: item.release_date ? item.release_date.split('-')[0] : 'N/A',
      genre: getGenreNames(item.genre_ids || []),
      description: item.overview || "Sugestão baseada nos seus gostos.",
      posterPath: item.poster_path
    }));
};
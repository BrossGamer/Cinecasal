import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { ViewMode, Movie, SearchResult, SortOption, StreamingPlatform, ToastMessage, ChallengeRecord } from './types';
import { searchMovies, getRecommendations } from './services/geminiService';
import RatingModal from './components/RatingModal';
import { 
  IconHeart, 
  IconFilm, 
  IconSearch, 
  IconStar, 
  IconPlus, 
  IconCheck, 
  IconHome, 
  IconList,
  IconTrash,
  IconShare,
  IconLoader,
  IconSort,
  IconSparkles,
  IconDice,
  IconTV,
  IconSwords,
  IconDownload,
  IconUpload,
  IconSettings,
  IconEdit,
  IconEyeOff,
  IconTrophy,
  IconTarget,
  IconMedal,
  IconFilter,
  IconClock
} from './components/Icons';

// --- Constants & Types ---
const ITEMS_PER_PAGE = 12;
const STREAMING_PLATFORMS: StreamingPlatform[] = ['Netflix', 'Prime', 'Disney+', 'HBO', 'AppleTV', 'Cinema', 'Outros'];
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const AVG_MOVIE_DURATION = 110; // Minutes

// --- Helper Functions ---
const getImageUrl = (path: string | undefined | null) => {
  if (!path) return 'https://via.placeholder.com/400x600?text=No+Image';
  if (path.startsWith('http')) return path; // Legacy data or full URL
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}${safePath}`;
};

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  e.currentTarget.src = 'https://via.placeholder.com/400x600?text=No+Image';
  e.currentTarget.onerror = null;
};

// --- Components ---

const Toast = ({ type, message, onClose }: { type: 'success'|'error'|'info', message: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    info: 'bg-indigo-600'
  };

  return (
    <div className={`${bgColors[type]} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto min-w-[300px] border border-white/10`}>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">✕</button>
    </div>
  );
};

const EditMovieModal = ({ movie, isOpen, onClose, onSave }: { movie: Movie, isOpen: boolean, onClose: () => void, onSave: (updated: Partial<Movie>) => void }) => {
  const [title, setTitle] = useState(movie.title);
  const [year, setYear] = useState(movie.year);
  const [imageUrl, setImageUrl] = useState(movie.imageUrl);
  const [platform, setPlatform] = useState<StreamingPlatform>(movie.platform || null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-700 shadow-2xl animate-in zoom-in duration-200">
        <h3 className="text-xl font-bold text-white mb-4">Editar Detalhes</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Ano</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">URL da Capa / Path TMDB</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
          </div>
           <div>
            <label className="text-xs text-slate-400">Onde Assistir</label>
            <select 
              value={platform || ''} 
              onChange={(e) => setPlatform(e.target.value as StreamingPlatform)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
            >
              <option value="">Selecione...</option>
              {STREAMING_PLATFORMS.map(p => <option key={p} value={p || ''}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 text-slate-400 hover:bg-slate-700 rounded">Cancelar</button>
          <button onClick={() => { onSave({ title, year, imageUrl, platform }); onClose(); }} className="flex-1 py-2 bg-rose-600 text-white rounded hover:bg-rose-500">Salvar</button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // State
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tmdbKey, setTmdbKey] = useState("");
  
  // Challenge Mode State
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [challengeHistory, setChallengeHistory] = useState<ChallengeRecord[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Modals & Interaction
  const [ratingModalMovie, setRatingModalMovie] = useState<Movie | null>(null);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [randomMovie, setRandomMovie] = useState<Movie | null>(null);
  const [sharingMovie, setSharingMovie] = useState<Movie | null>(null);
  const [battleMovies, setBattleMovies] = useState<[Movie, Movie] | null>(null);
  
  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Filters & Sorting
  const [watchlistSort, setWatchlistSort] = useState<SortOption>(SortOption.DATE_DESC);
  const [ratedSort, setRatedSort] = useState<SortOption>(SortOption.DATE_DESC);
  const [streamingFilter, setStreamingFilter] = useState<StreamingPlatform | 'ALL'>('ALL');
  const [genreFilter, setGenreFilter] = useState<string | 'ALL'>('ALL');

  // Pagination
  const [visibleWatchlistCount, setVisibleWatchlistCount] = useState(ITEMS_PER_PAGE);
  const [visibleRatedCount, setVisibleRatedCount] = useState(ITEMS_PER_PAGE);

  // Recommendations
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  // Refs
  const storyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  useEffect(() => {
    const saved = localStorage.getItem('cinecasal_data');
    if (saved) {
      try {
        setMovies(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved movies", e);
      }
    }
    const savedKey = localStorage.getItem('cinecasal_tmdb_key');
    if (savedKey) setTmdbKey(savedKey);
    
    const savedChallenges = localStorage.getItem('cinecasal_challenges');
    if (savedChallenges) setChallengeHistory(JSON.parse(savedChallenges));
    
    const savedActiveChallenge = localStorage.getItem('cinecasal_active_challenge');
    if (savedActiveChallenge) setActiveChallengeId(savedActiveChallenge);
  }, []);

  useEffect(() => {
    localStorage.setItem('cinecasal_data', JSON.stringify(movies));
  }, [movies]);

  useEffect(() => {
    localStorage.setItem('cinecasal_challenges', JSON.stringify(challengeHistory));
  }, [challengeHistory]);

  useEffect(() => {
    if (activeChallengeId) localStorage.setItem('cinecasal_active_challenge', activeChallengeId);
    else localStorage.removeItem('cinecasal_active_challenge');
  }, [activeChallengeId]);

  // Debounce Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        if (!tmdbKey) {
          addToast('error', 'Configure a chave da TMDB nos Ajustes!');
          return;
        }
        setIsSearching(true);
        const results = await searchMovies(searchQuery, tmdbKey);
        setSearchResults(results);
        setIsSearching(false);
      }
    }, 800);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, tmdbKey]);

  // --- Logic Functions ---

  const saveTmdbKey = (key: string) => {
    setTmdbKey(key);
    localStorage.setItem('cinecasal_tmdb_key', key);
    addToast('success', 'Chave API salva!');
  };

  const addToast = (type: 'success'|'error'|'info', message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addToWatchlist = (result: SearchResult) => {
    const newMovie: Movie = {
      id: crypto.randomUUID(),
      tmdbId: result.tmdbId,
      title: result.title,
      year: result.year,
      genre: result.genre,
      description: result.description,
      imageUrl: result.posterPath || "",
      isWatched: false,
      addedAt: Date.now(),
      platform: null,
      pickedBy: null,
      tags: []
    };
    setMovies(prev => [newMovie, ...prev]);
    setSearchQuery("");
    setSearchResults([]);
    setRecommendations(prev => prev.filter(r => r.tmdbId !== result.tmdbId));
    addToast('success', `${result.title} adicionado!`);
    setCurrentView(ViewMode.WATCHLIST);
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    setMovies(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    addToast('success', 'Atualizado.');
  };

  const removeMovie = (id: string) => {
    if(confirm("Tem certeza que deseja remover este filme?")) {
      setMovies(prev => prev.filter(m => m.id !== id));
      if (activeChallengeId === id) setActiveChallengeId(null);
      addToast('info', 'Filme removido.');
    }
  };

  const handleRateMovie = (id: string, rating: number, review: string) => {
    let challengeWon = false;
    
    // Check if winning a challenge
    if (activeChallengeId === id) {
      challengeWon = true;
      const movie = movies.find(m => m.id === id);
      if (movie) {
        setChallengeHistory(prev => [{
          id: crypto.randomUUID(),
          movieId: movie.id,
          movieTitle: movie.title,
          posterPath: movie.imageUrl,
          completedAt: Date.now(),
          ratingGiven: rating
        }, ...prev]);
      }
      setActiveChallengeId(null);
    }

    setMovies(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          isWatched: true,
          rating,
          userReview: review,
          watchedAt: Date.now()
        };
      }
      return m;
    }));

    if (challengeWon) {
      addToast('success', '🏆 Desafio Concluído!');
    } else {
      addToast('success', 'Avaliação salva!');
    }
    setCurrentView(ViewMode.RATED);
  };

  const startBattle = () => {
    const contenders = movies.filter(m => !m.isWatched);
    if (contenders.length < 2) {
      addToast('error', 'Adicione mais filmes para batalhar!');
      return;
    }
    const idx1 = Math.floor(Math.random() * contenders.length);
    let idx2 = Math.floor(Math.random() * contenders.length);
    while(idx1 === idx2) idx2 = Math.floor(Math.random() * contenders.length);
    
    setBattleMovies([contenders[idx1], contenders[idx2]]);
  };

  const handleBattlePick = (winner: Movie) => {
    if (!battleMovies) return;
    
    const contenders = movies.filter(m => !m.isWatched && m.id !== winner.id && m.id !== battleMovies[0].id && m.id !== battleMovies[1].id);
    
    if (contenders.length === 0) {
      setBattleMovies(null);
      setRandomMovie(winner); 
      return;
    }

    const nextChallenger = contenders[Math.floor(Math.random() * contenders.length)];
    setBattleMovies([winner, nextChallenger]);
  };

  const startChallenge = () => {
    const candidates = movies.filter(m => !m.isWatched);
    if (candidates.length === 0) {
      addToast('error', 'Lista vazia!');
      return;
    }
    const challenge = candidates[Math.floor(Math.random() * candidates.length)];
    setActiveChallengeId(challenge.id);
    addToast('info', 'Desafio iniciado!');
  };

  const cancelChallenge = () => {
    if(confirm('Desistir do desafio atual?')) {
      setActiveChallengeId(null);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({ movies, challenges: challengeHistory }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cinecasal_v1_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    addToast('success', 'Backup salvo!');
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.movies || Array.isArray(json)) {
          setMovies(json.movies || json);
          if (json.challenges) setChallengeHistory(json.challenges);
          addToast('success', 'Dados restaurados!');
          setCurrentView(ViewMode.DASHBOARD);
        } else {
          throw new Error("Formato inválido");
        }
      } catch (err) {
        addToast('error', 'Erro ao importar.');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateRecommendations = async () => {
    if (!tmdbKey) {
      addToast('error', 'Configure a API Key nos Ajustes!');
      return;
    }
    setIsLoadingRecommendations(true);
    const watched = movies.filter(m => m.isWatched);
    const results = await getRecommendations(watched, movies, tmdbKey);
    setRecommendations(results);
    setIsLoadingRecommendations(false);
  };

  const handleShare = async (movie: Movie) => {
    setSharingMovie(movie);
    setTimeout(async () => {
      if (storyRef.current) {
        try {
          const canvas = await html2canvas(storyRef.current, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#0f172a',
            scale: 2
          });
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `cinecasal-${movie.title.replace(/\s+/g, '-').toLowerCase()}.png`;
          link.click();
          addToast('success', 'Story gerado!');
        } catch (error) {
          console.error(error);
          addToast('error', 'Erro ao gerar imagem.');
        } finally {
          setSharingMovie(null);
        }
      }
    }, 1000); 
  };

  // --- Memos & Derived State ---

  const rawWatchedMovies = useMemo(() => movies.filter(m => m.isWatched), [movies]);
  const rawWatchList = useMemo(() => movies.filter(m => !m.isWatched), [movies]);
  
  const activeChallengeMovie = useMemo(() => movies.find(m => m.id === activeChallengeId), [movies, activeChallengeId]);

  // Extract Unique Genres
  const uniqueGenres = useMemo(() => {
    const allGenres = new Set<string>();
    movies.forEach(m => m.genre?.forEach(g => allGenres.add(g)));
    return Array.from(allGenres).sort();
  }, [movies]);

  const sortedWatchlist = useMemo(() => {
    let filtered = rawWatchList;
    if (streamingFilter !== 'ALL') {
      filtered = filtered.filter(m => m.platform === streamingFilter);
    }
    if (genreFilter !== 'ALL') {
      filtered = filtered.filter(m => m.genre?.includes(genreFilter));
    }
    return [...filtered].sort((a, b) => {
      switch (watchlistSort) {
        case SortOption.TITLE_ASC: return a.title.localeCompare(b.title);
        case SortOption.YEAR_DESC: return parseInt(b.year) - parseInt(a.year);
        case SortOption.YEAR_ASC: return parseInt(a.year) - parseInt(b.year);
        case SortOption.DATE_ASC: return a.addedAt - b.addedAt;
        default: return b.addedAt - a.addedAt;
      }
    });
  }, [rawWatchList, watchlistSort, streamingFilter, genreFilter]);

  const sortedRated = useMemo(() => {
    let filtered = rawWatchedMovies;
    if (genreFilter !== 'ALL') {
      filtered = filtered.filter(m => m.genre?.includes(genreFilter));
    }
    return [...filtered].sort((a, b) => {
      switch (ratedSort) {
        case SortOption.TITLE_ASC: return a.title.localeCompare(b.title);
        case SortOption.YEAR_DESC: return parseInt(b.year) - parseInt(a.year);
        case SortOption.YEAR_ASC: return parseInt(a.year) - parseInt(b.year);
        case SortOption.RATING_DESC: return (b.rating || 0) - (a.rating || 0);
        case SortOption.DATE_ASC: return (a.watchedAt || 0) - (b.watchedAt || 0);
        default: return (b.watchedAt || 0) - (a.watchedAt || 0);
      }
    });
  }, [rawWatchedMovies, ratedSort, genreFilter]);

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // 1 to 5
    rawWatchedMovies.forEach(m => {
      if (m.rating && m.rating >= 1 && m.rating <= 5) {
        dist[m.rating - 1]++;
      }
    });
    return dist.reverse(); // 5 to 1
  }, [rawWatchedMovies]);

  const totalTimeWatched = useMemo(() => {
    const minutes = rawWatchedMovies.length * AVG_MOVIE_DURATION;
    const hours = Math.floor(minutes / 60);
    if (hours > 24) {
      return `${(hours / 24).toFixed(1)} dias`;
    }
    return `${hours}h`;
  }, [rawWatchedMovies]);

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="text-center space-y-2 mb-10">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-rose-400 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
          CineCasal
        </h1>
        <p className="text-slate-400 text-lg">O diário definitivo da nossa história no cinema.</p>
        
        {!tmdbKey && movies.length === 0 && (
           <div className="mt-8 bg-slate-800 p-8 rounded-2xl border border-rose-500/30 max-w-2xl mx-auto shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">👋 Bem-vindos!</h3>
              <p className="text-slate-300 mb-6">Para começar a usar o app com capas e dados reais de filmes, você precisa de uma chave gratuita da TMDB.</p>
              <button onClick={() => setCurrentView(ViewMode.SETTINGS)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-rose-600/20">
                 Configurar Agora
              </button>
           </div>
        )}
      </div>

      {(movies.length > 0 || tmdbKey) && (
        <>
          {/* Challenge Mode Section */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-1 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12"><IconTrophy className="w-48 h-48 text-indigo-400" /></div>
            <div className="bg-slate-950/40 backdrop-blur-md rounded-[22px] p-6 relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                
                {/* Active Challenge Card */}
                <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="bg-rose-500 p-1.5 rounded-lg"><IconTarget className="w-4 h-4 text-white" /></div>
                      <h2 className="text-lg font-bold text-white uppercase tracking-wider">Desafio da Vez</h2>
                    </div>
                    
                    {activeChallengeMovie ? (
                      <div className="flex gap-4 bg-slate-800 p-4 rounded-xl border border-rose-500/50 relative overflow-hidden group shadow-lg shadow-rose-900/10">
                        <div className="absolute inset-0 bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors"></div>
                        <img src={getImageUrl(activeChallengeMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-20 h-28 object-cover rounded-lg shadow-lg z-10" />
                        <div className="flex flex-col justify-center z-10 flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-white truncate">{activeChallengeMovie.title}</h3>
                            <p className="text-slate-400 text-sm mb-3">Vocês precisam assistir isso!</p>
                            <div className="flex gap-2">
                              <button onClick={() => setRatingModalMovie(activeChallengeMovie)} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                                  <IconCheck className="w-4 h-4" /> Marcar
                              </button>
                              <button onClick={cancelChallenge} className="text-slate-500 hover:text-slate-300 text-xs px-2">Desistir</button>
                            </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-center gap-3 h-[146px]">
                        <p className="text-slate-400 text-sm">Sem desafio ativo.</p>
                        <button onClick={startChallenge} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 text-sm">
                            <IconTarget className="w-4 h-4" /> Novo Desafio
                        </button>
                      </div>
                    )}
                </div>

                {/* History / Stats */}
                <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-slate-700 md:pl-8 pt-6 md:pt-0">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <IconMedal className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-lg font-bold text-white">Galeria de Troféus</h2>
                      </div>
                      <span className="text-xl font-black text-yellow-500 bg-yellow-500/10 px-3 py-0.5 rounded-full">{challengeHistory.length}</span>
                    </div>
                    {challengeHistory.length > 0 ? (
                      <div className="space-y-3 max-h-[146px] overflow-y-auto pr-2 custom-scrollbar">
                        {challengeHistory.slice(0, 4).map(h => (
                            <div key={h.id} className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                              <div className="w-8 h-10 bg-slate-700 rounded overflow-hidden shrink-0">
                                  <img src={getImageUrl(h.posterPath)} className="w-full h-full object-cover opacity-80" />
                              </div>
                              <div className="min-w-0 flex-1">
                                  <h4 className="text-slate-200 text-sm font-medium truncate">{h.movieTitle}</h4>
                                  <p className="text-[10px] text-slate-500">{new Date(h.completedAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex text-yellow-500 gap-0.5 text-[10px] font-bold">
                                  {h.ratingGiven} <IconStar className="w-3 h-3" fill/>
                              </div>
                            </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[100px] flex items-center justify-center text-center">
                         <p className="text-slate-500 text-xs italic">Seus troféus aparecerão aqui.</p>
                      </div>
                    )}
                </div>

              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-2">
              <span className="text-3xl font-bold text-white">{rawWatchedMovies.length}</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1"><IconFilm className="w-3 h-3"/> Vistos</span>
            </div>
            
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-2">
              <span className="text-3xl font-bold text-white">{(rawWatchedMovies.reduce((acc, c) => acc + (c.rating||0), 0) / (rawWatchedMovies.length || 1)).toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1"><IconStar className="w-3 h-3"/> Média</span>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-2">
               <span className="text-3xl font-bold text-white">{rawWatchList.length}</span>
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1"><IconList className="w-3 h-3"/> Fila</span>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all flex flex-col items-center justify-center gap-2">
               <span className="text-xl font-bold text-white">{totalTimeWatched}</span>
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wider flex items-center gap-1"><IconClock className="w-3 h-3"/> Tempo Juntos</span>
            </div>
            
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all flex flex-col items-center justify-end relative overflow-hidden h-28 lg:h-auto col-span-2 lg:col-span-1">
               <div className="flex items-end justify-center gap-1 h-full w-full pb-4">
                  {ratingDistribution.map((count, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 h-full justify-end w-4">
                       <div style={{height: `${(count / (rawWatchedMovies.length || 1)) * 100}%`}} className={`w-full rounded-t-sm ${i === 0 ? 'bg-rose-500' : 'bg-slate-600'}`}></div>
                    </div>
                  ))}
               </div>
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wider absolute bottom-2">Distribuição</span>
            </div>
          </div>

          {/* Recommendations Section */}
          <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400">
                    <IconSparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Sugestões Inteligentes</h2>
                </div>
                {!isLoadingRecommendations && recommendations.length > 0 && (
                  <button onClick={handleGenerateRecommendations} className="text-xs text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider">Atualizar</button>
                )}
              </div>
              {recommendations.length === 0 && !isLoadingRecommendations ? (
                <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 p-8 rounded-2xl border border-purple-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Precisam de inspiração?</h3>
                    <p className="text-slate-400 text-sm">O sistema analisa o que vocês assistiram e sugere novos títulos compatíveis.</p>
                  </div>
                  <button onClick={handleGenerateRecommendations} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-900/20 whitespace-nowrap">
                    <IconSparkles className="w-4 h-4" /> Gerar Sugestões
                  </button>
                </div>
              ) : isLoadingRecommendations ? (
                <div className="flex justify-center py-12"><IconLoader className="w-8 h-8 text-purple-500" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
                  {recommendations.map((movie, idx) => (
                    <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-purple-500/40 transition-all flex flex-col gap-3 group">
                      <div className="flex gap-3">
                        <img src={getImageUrl(movie.posterPath)} crossOrigin="anonymous" onError={handleImageError} className="w-16 h-24 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform" />
                        <div className="min-w-0">
                          <h3 className="font-bold text-white truncate">{movie.title}</h3>
                          <p className="text-purple-400 text-xs mb-1">{movie.year}</p>
                          <div className="flex flex-wrap gap-1">
                             {movie.genre.slice(0,2).map(g => <span key={g} className="text-[10px] bg-slate-700 px-1.5 rounded text-slate-300">{g}</span>)}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => addToWatchlist(movie)} className="mt-auto bg-slate-700 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                        <IconPlus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </>
      )}
      
      {/* Footer */}
      <footer className="pt-12 pb-4 text-center">
         <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-6"></div>
         <p className="text-slate-600 text-xs font-medium">CineCasal v1.0 Final • Feito com ❤️</p>
      </footer>
    </div>
  );

  const renderWatchlist = () => {
    if (movies.length === 0 && searchQuery === "") {
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
             <div className="bg-slate-800 p-8 rounded-full border border-slate-700 shadow-2xl"><IconFilm className="w-16 h-16 text-slate-500" /></div>
             <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Sua lista está vazia</h2>
                <p className="text-slate-400 max-w-sm mx-auto">Comece adicionando filmes que vocês querem ver juntos.</p>
             </div>
             <button onClick={() => setCurrentView(ViewMode.SEARCH)} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-transform hover:scale-105">
               <IconSearch className="w-5 h-5" /> Buscar Filmes
             </button>
          </div>
        );
    }
    
    return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-6 sticky top-0 md:static z-20 bg-slate-900/95 md:bg-transparent backdrop-blur md:backdrop-blur-none py-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Minha Lista</h2>
            <p className="text-slate-400 text-sm">{sortedWatchlist.length} títulos esperando pipoca</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
             <button className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-lg shadow-rose-600/20" onClick={() => setCurrentView(ViewMode.SEARCH)}>
              <IconPlus className="w-4 h-4" /> Novo
            </button>
            <button onClick={() => { const r = sortedWatchlist[Math.floor(Math.random() * sortedWatchlist.length)]; if(r) setRandomMovie(r); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-600/20">
              <IconDice className="w-4 h-4" /> Roleta
            </button>
            <button onClick={startBattle} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap shadow-lg shadow-orange-600/20">
              <IconSwords className="w-4 h-4" /> Batalha
            </button>
          </div>
        </div>
        
        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 bg-slate-800/80 backdrop-blur p-2 rounded-xl border border-slate-700/50">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-lg">
             <IconSort className="w-4 h-4 text-slate-400" />
             <select value={watchlistSort} onChange={(e) => setWatchlistSort(e.target.value as SortOption)} className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer">
               <option value={SortOption.DATE_DESC}>Recentes</option>
               <option value={SortOption.TITLE_ASC}>A-Z</option>
               <option value={SortOption.YEAR_DESC}>Lançamento</option>
             </select>
           </div>
           
           <div className="w-px bg-slate-600 h-6 self-center mx-1"></div>

           <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-lg">
             <IconTV className="w-4 h-4 text-slate-400" />
             <select value={streamingFilter} onChange={(e) => setStreamingFilter(e.target.value as any)} className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer max-w-[100px]">
               <option value="ALL">Todos Apps</option>
               {STREAMING_PLATFORMS.map(p => <option key={p} value={p || ''}>{p}</option>)}
             </select>
           </div>

           <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-lg">
             <IconFilter className="w-4 h-4 text-slate-400" />
             <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer max-w-[100px]">
               <option value="ALL">Todos Gêneros</option>
               {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
             </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
        {sortedWatchlist.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 italic">Nenhum filme encontrado com estes filtros.</div>
        ) : (
        sortedWatchlist.slice(0, visibleWatchlistCount).map(movie => (
          <div key={movie.id} className="bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-700 flex flex-col h-full relative group hover:border-slate-500 transition-all duration-300">
            <div className="relative h-56 overflow-hidden">
              <img src={getImageUrl(movie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              {activeChallengeId === movie.id && (
                <div className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg animate-pulse z-10">
                   <IconTarget className="w-3 h-3"/> DESAFIO
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                 <div className="flex justify-between items-end">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-xl font-bold text-white shadow-black drop-shadow-md truncate leading-tight">{movie.title}</h3>
                    <p className="text-rose-300 text-sm font-medium">{movie.year}</p>
                  </div>
                  {movie.platform && (
                    <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border border-white/10 shadow-lg">
                      {movie.platform}
                    </span>
                  )}
                 </div>
              </div>
               <button onClick={() => setEditingMovie(movie)} className="absolute top-3 right-11 bg-black/40 backdrop-blur text-white p-2 rounded-full hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-all z-10">
                <IconEdit className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeMovie(movie.id)} className="absolute top-3 right-3 bg-black/40 backdrop-blur text-white p-2 rounded-full hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-all z-10">
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="p-4 flex-1 flex flex-col bg-slate-800">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex gap-1 flex-wrap">
                    {movie.genre.slice(0,2).map(g => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">{g}</span>)}
                 </div>
                 {/* Who picked toggle */}
                 <div 
                  onClick={() => updateMovie(movie.id, { pickedBy: movie.pickedBy === 'A' ? 'B' : movie.pickedBy === 'B' ? null : 'A' })}
                  className={`cursor-pointer w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${movie.pickedBy === 'A' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : movie.pickedBy === 'B' ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-slate-700 border-slate-600 text-slate-500 hover:border-slate-400'}`}
                  title="Quem escolheu?"
                 >
                   {movie.pickedBy || '?'}
                 </div>
              </div>
              
              <p className="text-slate-400 text-xs line-clamp-3 mb-4 flex-1 leading-relaxed">{movie.description}</p>
              
              {!movie.platform && (
                 <div className="mb-4">
                   <select 
                     onChange={(e) => updateMovie(movie.id, { platform: e.target.value as StreamingPlatform })}
                     className="w-full bg-slate-900 text-xs text-slate-400 border border-slate-700 rounded-lg p-2 outline-none focus:border-rose-500 transition-colors cursor-pointer"
                   >
                     <option value="">Onde assistir?</option>
                     {STREAMING_PLATFORMS.map(p => <option key={p} value={p || ''}>{p}</option>)}
                   </select>
                 </div>
              )}

              <button onClick={() => setRatingModalMovie(movie)} className="w-full bg-slate-700 hover:bg-rose-600 text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-lg hover:shadow-rose-600/20 active:scale-95">
                <IconCheck className="w-4 h-4" /> Marcar como Visto
              </button>
            </div>
          </div>
        )))}
      </div>
       {visibleWatchlistCount < sortedWatchlist.length && (
          <div className="flex justify-center pb-8">
            <button onClick={() => setVisibleWatchlistCount(prev => prev + ITEMS_PER_PAGE)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-2 rounded-lg text-sm border border-slate-600 font-medium transition-colors">Carregar Mais</button>
          </div>
        )}
    </div>
  )};

  const renderRated = () => {
    if (rawWatchedMovies.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
             <div className="bg-slate-800 p-8 rounded-full border border-slate-700 shadow-2xl"><IconStar className="w-16 h-16 text-yellow-500/50" /></div>
             <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Nenhum filme avaliado</h2>
                <p className="text-slate-400 max-w-sm mx-auto">Os filmes que vocês marcarem como vistos aparecerão aqui.</p>
             </div>
             <button onClick={() => setCurrentView(ViewMode.WATCHLIST)} className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
               Ir para Lista
             </button>
        </div>
      )
    }

    return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 md:static z-20 bg-slate-900/95 md:bg-transparent backdrop-blur py-2">
        <h2 className="text-3xl font-bold text-white tracking-tight">Nosso Diário</h2>
        
        <div className="flex gap-2 bg-slate-800/80 backdrop-blur p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto w-full md:w-auto">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-lg">
             <IconSort className="w-4 h-4 text-slate-400" />
             <select value={ratedSort} onChange={(e) => setRatedSort(e.target.value as SortOption)} className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer">
               <option value={SortOption.DATE_DESC}>Recentes</option>
               <option value={SortOption.RATING_DESC}>Melhores Notas</option>
             </select>
           </div>
           
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/50 rounded-lg">
             <IconFilter className="w-4 h-4 text-slate-400" />
             <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer max-w-[120px]">
               <option value="ALL">Todos Gêneros</option>
               {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
             </select>
           </div>
        </div>
      </div>

      <div className="space-y-4 pb-12">
        {sortedRated.slice(0, visibleRatedCount).map(movie => (
           <div key={movie.id} className="bg-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-5 relative group border border-slate-700 hover:border-rose-500/30 transition-all hover:bg-slate-800/80">
              <div className="shrink-0 relative">
                 <img src={getImageUrl(movie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full md:w-28 h-40 object-cover rounded-lg shadow-lg" />
                 <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-500 text-slate-900 px-2 py-0.5 rounded font-bold text-xs shadow-md">
                     <span className="text-sm">{movie.rating}</span> <IconStar className="w-3 h-3 fill-slate-900" fill />
                 </div>
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-start mb-1">
                   <div>
                     <h3 className="text-xl font-bold text-white truncate hover:text-rose-400 transition-colors">{movie.title}</h3>
                     <p className="text-slate-400 text-xs flex items-center gap-2">
                        {new Date(movie.watchedAt!).toLocaleDateString()} • {movie.year}
                        {movie.genre[0] && <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">{movie.genre[0]}</span>}
                     </p>
                   </div>
                </div>
                
                {/* Review with Spoiler Guard */}
                <div className="relative mt-3 group/review cursor-pointer flex-1">
                  <div className={`text-slate-300 text-sm italic border-l-4 border-rose-600/50 pl-4 py-1 ${(movie.userReview?.length || 0) > 50 ? 'blur-sm group-hover/review:blur-0 transition-all duration-300' : ''}`}>
                    "{movie.userReview || "Sem comentário."}"
                  </div>
                  {(movie.userReview?.length || 0) > 50 && (
                    <div className="absolute inset-0 flex items-center justify-center group-hover/review:opacity-0 pointer-events-none transition-opacity">
                      <div className="bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full text-xs text-white flex gap-2 items-center font-medium border border-white/10"><IconEyeOff className="w-3 h-3"/> Toque para ver spoiler</div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-3 justify-end items-center border-t border-slate-700 pt-3">
                   <button onClick={() => handleShare(movie)} className="text-xs bg-slate-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-medium"><IconShare className="w-3.5 h-3.5"/> Compartilhar Story</button>
                   <div className="w-px h-4 bg-slate-600 mx-1"></div>
                   <button onClick={() => removeMovie(movie.id)} className="text-xs text-slate-500 hover:text-rose-500 px-2 py-1 transition-colors flex items-center gap-1"><IconTrash className="w-3 h-3"/> Excluir</button>
                </div>
              </div>
           </div>
        ))}
         {visibleRatedCount < sortedRated.length && (
          <div className="flex justify-center mt-6 mb-8">
            <button onClick={() => setVisibleRatedCount(prev => prev + ITEMS_PER_PAGE)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-2 rounded-lg text-sm border border-slate-600 font-medium transition-colors">Carregar Mais</button>
          </div>
        )}
      </div>
    </div>
  )};

  const renderSettings = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pb-12">
      <h2 className="text-3xl font-bold text-white tracking-tight">Ajustes & Dados</h2>
      
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl space-y-8">
        <div>
           <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3"><IconSettings className="w-5 h-5 text-rose-500"/> Integração TMDB</h3>
           <p className="text-slate-400 text-sm mb-4 leading-relaxed">
             Para que o app mostre capas, sinopses e sugestões inteligentes, é necessário uma chave de API gratuita.
             Crie a sua em <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-rose-400 hover:text-rose-300 underline font-medium">themoviedb.org</a> (v3 auth).
           </p>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={tmdbKey} 
               onChange={(e) => setTmdbKey(e.target.value)} 
               placeholder="Cole sua API Key aqui..."
               className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-rose-500 outline-none transition-colors font-mono text-sm"
             />
             <button onClick={() => saveTmdbKey(tmdbKey)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-rose-600/20">Salvar</button>
           </div>
           {tmdbKey && <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1"><IconCheck className="w-3 h-3"/> Chave configurada</p>}
        </div>

        <div className="border-t border-slate-700 pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
             <h3 className="text-base font-bold text-white flex items-center gap-2"><IconDownload className="w-4 h-4 text-emerald-500"/> Backup (Exportar)</h3>
             <p className="text-slate-500 text-xs">Salve todos os dados em um arquivo JSON seguro.</p>
             <button onClick={exportData} className="w-full bg-slate-700 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-slate-600 hover:border-emerald-500">
               Baixar Dados
             </button>
          </div>
          <div className="space-y-2">
             <h3 className="text-base font-bold text-white flex items-center gap-2"><IconUpload className="w-4 h-4 text-blue-500"/> Restaurar (Importar)</h3>
             <p className="text-slate-500 text-xs">Recupere dados de um arquivo anterior.</p>
             <input ref={fileInputRef} type="file" accept=".json" onChange={importData} className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-700 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border border-slate-600 hover:border-blue-500">
               Selecionar Arquivo
             </button>
          </div>
        </div>
        
        <div className="border-t border-slate-700 pt-6 text-center">
           <p className="text-xs text-slate-500 font-medium">CineCasal v1.0 Final • Dados fornecidos pela TMDB API</p>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ mode, icon: Icon, label }: { mode: ViewMode, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(mode)}
      className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-6 md:py-3.5 rounded-xl transition-all w-full md:w-auto mb-1 ${
        currentView === mode 
          ? 'text-white bg-gradient-to-r from-rose-600 to-rose-500 font-bold shadow-lg shadow-rose-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className={`w-6 h-6 md:w-5 md:h-5 ${currentView === mode ? 'fill-current opacity-100' : ''}`} />
      <span className="text-[10px] md:text-sm mt-1 md:mt-0">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-rose-500/30 overflow-x-hidden">
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => <Toast key={t.id} type={t.type} message={t.message} onClose={() => removeToast(t.id)} />)}
      </div>

      <div className="md:flex min-h-screen max-w-7xl mx-auto">
        <nav className="fixed md:sticky bottom-0 left-0 right-0 md:top-0 md:h-screen bg-slate-900/95 md:bg-slate-900 backdrop-blur-lg border-t md:border-t-0 md:border-r border-slate-800/50 z-40 md:w-72 flex-shrink-0">
          <div className="flex md:flex-col h-full p-2 md:p-6 justify-around md:justify-start gap-1 md:gap-2">
            <div className="hidden md:flex flex-col gap-1 mb-10 px-4 mt-4">
              <div className="flex items-center gap-3">
                 <div className="bg-gradient-to-br from-rose-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-rose-500/20"><IconHeart className="w-6 h-6 text-white" /></div>
                 <span className="text-2xl font-black tracking-tight text-white">CineCasal</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium pl-14">v1.0 Final</span>
            </div>
            <NavItem mode={ViewMode.DASHBOARD} icon={IconHome} label="Dashboard" />
            <NavItem mode={ViewMode.WATCHLIST} icon={IconList} label="Para Assistir" />
            <NavItem mode={ViewMode.RATED} icon={IconStar} label="Diário" />
            <div className="flex-1 hidden md:block"></div>
            <NavItem mode={ViewMode.SETTINGS} icon={IconSettings} label="Ajustes" />
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-10 pb-24 md:pb-10 w-full">
           {currentView === ViewMode.DASHBOARD && renderDashboard()}
           {currentView === ViewMode.WATCHLIST && renderWatchlist()}
           {currentView === ViewMode.RATED && renderRated()}
           {currentView === ViewMode.SEARCH && (
              <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                 <div className="text-center space-y-2">
                   <h2 className="text-3xl font-bold text-white">Adicionar Filme</h2>
                   <p className="text-slate-400">Busque na base de dados global e adicione à lista.</p>
                 </div>
                 
                 <form onSubmit={(e) => { e.preventDefault(); /* handled by effect */ }}>
                    <div className="relative group">
                       <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Digite o nome do filme..." className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 pl-14 text-xl text-white focus:border-rose-500 outline-none shadow-xl transition-all" autoFocus />
                       <IconSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-500 w-6 h-6 transition-colors" />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2">{isSearching && <IconLoader className="text-rose-500 w-6 h-6" />}</div>
                    </div>
                 </form>

                 {!tmdbKey && <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-center text-rose-300 text-sm">⚠️ Para buscar filmes reais, configure a API Key da TMDB nos Ajustes.</div>}
                 
                 <div className="space-y-4">
                   {searchResults.map((r, i) => (
                      <div key={i} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex gap-5 hover:border-rose-500/50 hover:bg-slate-800/80 cursor-pointer transition-all group" onClick={() => addToWatchlist(r)}>
                        <div className="w-16 h-24 bg-slate-700 rounded-lg shrink-0 overflow-hidden shadow-lg"><img src={getImageUrl(r.posterPath)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                        <div className="flex-1 min-w-0 py-1">
                           <h3 className="font-bold text-lg text-white group-hover:text-rose-400 transition-colors">{r.title}</h3>
                           <p className="text-xs text-slate-400 font-medium mb-1">{r.year} • {r.genre.slice(0,3).join(', ')}</p>
                           <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{r.description}</p>
                        </div>
                        <button className="bg-slate-700 group-hover:bg-rose-600 rounded-full p-3 h-fit self-center transition-colors shadow-lg"><IconPlus className="w-5 h-5 text-white" /></button>
                      </div>
                   ))}
                 </div>
              </div>
           )}
           {currentView === ViewMode.SETTINGS && renderSettings()}
        </main>
      </div>

      {/* Modals */}
      {ratingModalMovie && (
        <RatingModal movie={ratingModalMovie} isOpen={!!ratingModalMovie} onClose={() => setRatingModalMovie(null)} onSave={handleRateMovie} />
      )}
      {editingMovie && (
        <EditMovieModal movie={editingMovie} isOpen={!!editingMovie} onClose={() => setEditingMovie(null)} onSave={(updated) => updateMovie(editingMovie.id, updated)} />
      )}

      {/* Battle Mode Overlay */}
      {battleMovies && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center p-4 animate-in zoom-in duration-300">
           <div className="bg-orange-500/10 p-4 rounded-full mb-6 border-2 border-orange-500/20"><IconSwords className="w-12 h-12 text-orange-500"/></div>
           <h2 className="text-3xl font-black text-white mb-8 uppercase tracking-widest text-center">Batalha de Filmes</h2>
           <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center">
              <div onClick={() => handleBattlePick(battleMovies[0])} className="group cursor-pointer bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 hover:scale-105 transition-all p-4 rounded-3xl w-72 text-center shadow-2xl relative overflow-hidden">
                 <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors z-0"></div>
                 <img src={getImageUrl(battleMovies[0].imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-96 object-cover rounded-2xl mb-4 shadow-lg z-10 relative" />
                 <h3 className="font-bold text-xl text-white z-10 relative">{battleMovies[0].title}</h3>
              </div>
              <div className="text-3xl font-black text-slate-700">VS</div>
              <div onClick={() => handleBattlePick(battleMovies[1])} className="group cursor-pointer bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 hover:scale-105 transition-all p-4 rounded-3xl w-72 text-center shadow-2xl relative overflow-hidden">
                 <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors z-0"></div>
                 <img src={getImageUrl(battleMovies[1].imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-96 object-cover rounded-2xl mb-4 shadow-lg z-10 relative" />
                 <h3 className="font-bold text-xl text-white z-10 relative">{battleMovies[1].title}</h3>
              </div>
           </div>
           <button onClick={() => setBattleMovies(null)} className="mt-12 text-slate-500 hover:text-white transition-colors border-b border-transparent hover:border-white text-sm pb-1">Cancelar Batalha</button>
        </div>
      )}

      {/* Random Pick Overlay */}
      {randomMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-slate-800 border border-indigo-500/50 rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
            <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><IconDice className="w-8 h-8 text-indigo-400" /></div>
            <p className="text-indigo-300 font-bold uppercase tracking-wider text-xs mb-2">O destino escolheu:</p>
            <h2 className="text-2xl font-black text-white mb-6 leading-tight">{randomMovie.title}</h2>
            <div className="relative group cursor-pointer" onClick={() => { setRandomMovie(null); setRatingModalMovie(randomMovie); }}>
               <img src={getImageUrl(randomMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-40 h-60 object-cover rounded-xl shadow-2xl mb-8 mx-auto border-4 border-slate-700 group-hover:border-indigo-500 transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRandomMovie(null)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 font-bold">Fechar</button>
              <button onClick={() => { setRandomMovie(null); setRatingModalMovie(randomMovie); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-bold shadow-lg shadow-indigo-600/20">Assistir Agora</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Story Template */}
      {sharingMovie && (
         <div ref={storyRef} style={{position: 'fixed', top: 0, left: '-9999px', width: '540px', height: '960px', zIndex: -10}} className="bg-slate-900 flex flex-col relative overflow-hidden text-white font-sans">
            {/* Background Layer */}
            <div className="absolute inset-0 z-0">
               <img src={getImageUrl(sharingMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-full object-cover opacity-40 blur-2xl scale-125" />
               <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/90" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full p-10 items-center justify-between text-center border-[12px] border-slate-950">
               <div className="mt-12 flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/20 shadow-xl">
                  <IconHeart className="w-6 h-6 text-rose-500 fill-rose-500" />
                  <span className="font-bold tracking-wide uppercase text-sm">CineCasal Review</span>
               </div>
               
               <div className="flex flex-col items-center w-full gap-8">
                  <div className="p-4 bg-white/10 backdrop-blur-sm rounded-3xl -rotate-2 shadow-2xl border border-white/10">
                     <img src={getImageUrl(sharingMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-64 h-96 object-cover rounded-2xl shadow-inner" />
                  </div>
                  
                  <div className="space-y-2">
                     <h1 className="text-4xl font-black text-white leading-tight drop-shadow-lg">{sharingMovie.title}</h1>
                     <p className="text-slate-300 text-lg font-medium">{sharingMovie.year}</p>
                  </div>
                  
                  <div className="flex gap-3 text-yellow-400 drop-shadow-lg">
                     {[1,2,3,4,5].map(s => (
                        <IconStar key={s} className="w-10 h-10" fill={s <= (sharingMovie.rating||0)} />
                     ))}
                  </div>
               </div>
               
               <div className="mb-16 bg-slate-800/60 p-8 rounded-[32px] backdrop-blur-md w-full border border-white/10 shadow-2xl">
                  <IconShare className="w-8 h-8 text-rose-500 mx-auto mb-4 opacity-80" />
                  <p className="text-2xl italic text-slate-100 font-serif leading-relaxed">"{sharingMovie.userReview}"</p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
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
  IconMedal
} from './components/Icons';

// --- Constants & Types ---
const ITEMS_PER_PAGE = 12;
const STREAMING_PLATFORMS: StreamingPlatform[] = ['Netflix', 'Prime', 'Disney+', 'HBO', 'AppleTV', 'Cinema', 'Outros'];
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

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
    info: 'bg-blue-600'
  };

  return (
    <div className={`${bgColors[type]} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto min-w-[300px]`}>
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
          addToast('error', 'Configure a chave da TMDB nos Ajustes primeiro!');
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
    addToast('success', `${result.title} adicionado à lista!`);
    setCurrentView(ViewMode.WATCHLIST);
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    setMovies(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    addToast('success', 'Filme atualizado.');
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
      addToast('success', 'DESAFIO CUMPRIDO! 🏆 Conquista registrada!');
    } else {
      addToast('success', 'Avaliação salva com sucesso!');
    }
    setCurrentView(ViewMode.RATED);
  };

  const startBattle = () => {
    const contenders = movies.filter(m => !m.isWatched);
    if (contenders.length < 2) {
      addToast('error', 'Precisa de pelo menos 2 filmes na lista!');
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
      addToast('error', 'Sua lista está vazia! Adicione filmes primeiro.');
      return;
    }
    const challenge = candidates[Math.floor(Math.random() * candidates.length)];
    setActiveChallengeId(challenge.id);
    addToast('info', 'Desafio iniciado! Boa sorte!');
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
    link.download = `cinecasal_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    addToast('success', 'Backup gerado com sucesso!');
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
          addToast('success', 'Dados importados com sucesso!');
          setCurrentView(ViewMode.DASHBOARD);
        } else {
          throw new Error("Formato inválido");
        }
      } catch (err) {
        addToast('error', 'Erro ao ler arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateRecommendations = async () => {
    if (!tmdbKey) {
      addToast('error', 'Configure a chave da TMDB nos Ajustes!');
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
          addToast('success', 'Imagem gerada!');
        } catch (error) {
          console.error(error);
          addToast('error', 'Erro ao gerar imagem. Verifique CORS.');
        } finally {
          setSharingMovie(null);
        }
      }
    }, 800); // Increased timeout for images to load
  };

  // --- Memos & Derived State ---

  const rawWatchedMovies = useMemo(() => movies.filter(m => m.isWatched), [movies]);
  const rawWatchList = useMemo(() => movies.filter(m => !m.isWatched), [movies]);
  
  const activeChallengeMovie = useMemo(() => movies.find(m => m.id === activeChallengeId), [movies, activeChallengeId]);

  const sortedWatchlist = useMemo(() => {
    let filtered = rawWatchList;
    if (streamingFilter !== 'ALL') {
      filtered = filtered.filter(m => m.platform === streamingFilter);
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
  }, [rawWatchList, watchlistSort, streamingFilter]);

  const sortedRated = useMemo(() => {
    return [...rawWatchedMovies].sort((a, b) => {
      switch (ratedSort) {
        case SortOption.TITLE_ASC: return a.title.localeCompare(b.title);
        case SortOption.YEAR_DESC: return parseInt(b.year) - parseInt(a.year);
        case SortOption.YEAR_ASC: return parseInt(a.year) - parseInt(b.year);
        case SortOption.RATING_DESC: return (b.rating || 0) - (a.rating || 0);
        case SortOption.DATE_ASC: return (a.watchedAt || 0) - (b.watchedAt || 0);
        default: return (b.watchedAt || 0) - (a.watchedAt || 0);
      }
    });
  }, [rawWatchedMovies, ratedSort]);

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // 1 to 5
    rawWatchedMovies.forEach(m => {
      if (m.rating && m.rating >= 1 && m.rating <= 5) {
        dist[m.rating - 1]++;
      }
    });
    return dist.reverse(); // 5 to 1
  }, [rawWatchedMovies]);

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent">
          Olá, Casal!
        </h1>
        <p className="text-slate-400">Aqui está o resumo da jornada cinematográfica de vocês.</p>
        {!tmdbKey && <div className="p-2 bg-yellow-500/20 text-yellow-300 text-xs rounded-lg inline-block cursor-pointer" onClick={() => setCurrentView(ViewMode.SETTINGS)}>⚠️ Configure a API Key em Ajustes para buscar filmes</div>}
      </div>

      {/* Challenge Mode Section */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-1 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-20"><IconTrophy className="w-32 h-32 text-indigo-400" /></div>
        <div className="bg-slate-900/50 backdrop-blur-md rounded-[22px] p-6">
           <div className="flex flex-col md:flex-row gap-6 items-center">
             
             {/* Active Challenge Card */}
             <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-4">
                  <IconTarget className="w-6 h-6 text-rose-500" />
                  <h2 className="text-xl font-bold text-white uppercase tracking-wider">Desafio Atual</h2>
                </div>
                
                {activeChallengeMovie ? (
                  <div className="flex gap-4 bg-slate-800 p-4 rounded-xl border border-rose-500/50 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors"></div>
                     <img src={getImageUrl(activeChallengeMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-20 h-28 object-cover rounded-lg shadow-lg z-10" />
                     <div className="flex flex-col justify-center z-10 flex-1">
                        <h3 className="text-lg font-bold text-white">{activeChallengeMovie.title}</h3>
                        <p className="text-slate-400 text-sm mb-3">Vocês precisam assistir isso!</p>
                        <div className="flex gap-2">
                           <button onClick={() => setRatingModalMovie(activeChallengeMovie)} className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                              <IconCheck className="w-4 h-4" /> Marcar Visto
                           </button>
                           <button onClick={cancelChallenge} className="text-slate-500 hover:text-slate-300 text-xs px-2">Desistir</button>
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-600 flex flex-col items-center justify-center text-center gap-3">
                     <p className="text-slate-400 text-sm">Sem desafio ativo no momento.</p>
                     <button onClick={startChallenge} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                        <IconTarget className="w-4 h-4" /> Iniciar Novo Desafio
                     </button>
                  </div>
                )}
             </div>

             {/* History / Stats */}
             <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-slate-700 md:pl-6 pt-6 md:pt-0">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <IconMedal className="w-6 h-6 text-yellow-500" />
                     <h2 className="text-lg font-bold text-white">Conquistas</h2>
                   </div>
                   <span className="text-2xl font-black text-yellow-500">{challengeHistory.length}</span>
                </div>
                {challengeHistory.length > 0 ? (
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                     {challengeHistory.slice(0, 4).map(h => (
                        <div key={h.id} className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700/50">
                           <div className="w-8 h-10 bg-slate-700 rounded overflow-hidden shrink-0">
                              <img src={getImageUrl(h.posterPath)} className="w-full h-full object-cover opacity-80" />
                           </div>
                           <div className="min-w-0 flex-1">
                              <h4 className="text-slate-200 text-sm font-medium truncate">{h.movieTitle}</h4>
                              <p className="text-[10px] text-slate-500">{new Date(h.completedAt).toLocaleDateString()}</p>
                           </div>
                           <div className="flex text-yellow-500 gap-0.5 text-[10px]">
                              {h.ratingGiven}★
                           </div>
                        </div>
                     ))}
                  </div>
                ) : (
                   <p className="text-slate-500 text-xs italic text-center py-8">Complete desafios para encher sua galeria de troféus!</p>
                )}
             </div>

           </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center">
          <div className="p-3 bg-rose-500/10 rounded-full mb-3 text-rose-500">
            <IconFilm className="w-6 h-6" />
          </div>
          <span className="text-3xl font-bold text-white">{rawWatchedMovies.length}</span>
          <span className="text-xs text-slate-400 font-medium">Vistos</span>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center">
          <div className="p-3 bg-yellow-500/10 rounded-full mb-3 text-yellow-500">
            <IconStar className="w-6 h-6" fill />
          </div>
          <span className="text-3xl font-bold text-white">{(rawWatchedMovies.reduce((acc, c) => acc + (c.rating||0), 0) / (rawWatchedMovies.length || 1)).toFixed(1)}</span>
          <span className="text-xs text-slate-400 font-medium">Nota Média</span>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center">
          <div className="p-3 bg-blue-500/10 rounded-full mb-3 text-blue-500">
            <IconList className="w-6 h-6" />
          </div>
          <span className="text-3xl font-bold text-white">{rawWatchList.length}</span>
          <span className="text-xs text-slate-400 font-medium">Na Lista</span>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-end justify-center gap-1 p-4 pb-0 opacity-20">
             {ratingDistribution.map((count, i) => (
                <div key={i} style={{height: `${(count / (rawWatchedMovies.length || 1)) * 100}%`}} className="w-2 bg-rose-500 rounded-t-sm"></div>
             ))}
          </div>
          <div className="p-3 bg-green-500/10 rounded-full mb-3 text-green-500 z-10">
            <IconHeart className="w-6 h-6" />
          </div>
          <span className="text-3xl font-bold text-white">{ratingDistribution[0]}</span>
          <span className="text-xs text-slate-400 font-medium z-10">Notas Máximas (5★)</span>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400">
                <IconSparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Sugestões (TMDB)</h2>
            </div>
            {!isLoadingRecommendations && recommendations.length > 0 && (
              <button onClick={handleGenerateRecommendations} className="text-xs text-purple-400 hover:text-purple-300">Atualizar</button>
            )}
          </div>
          {recommendations.length === 0 && !isLoadingRecommendations ? (
             <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 p-6 rounded-2xl border border-purple-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
               <div>
                 <p className="text-slate-200 font-medium mb-1">Sem ideias?</p>
                 <p className="text-slate-400 text-sm">O sistema busca filmes similares aos que vocês gostaram.</p>
               </div>
               <button onClick={handleGenerateRecommendations} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2">
                 <IconSparkles className="w-4 h-4" /> Gerar Sugestões
               </button>
             </div>
          ) : isLoadingRecommendations ? (
            <div className="flex justify-center py-8"><IconLoader className="w-8 h-8 text-purple-500" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((movie, idx) => (
                <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-purple-500/40 transition-all flex flex-col gap-3">
                  <div className="flex gap-3">
                    <img src={getImageUrl(movie.posterPath)} crossOrigin="anonymous" onError={handleImageError} className="w-14 h-20 object-cover rounded-lg" />
                    <div>
                      <h3 className="font-bold text-white truncate w-32">{movie.title}</h3>
                      <p className="text-purple-400 text-xs">{movie.year} • {movie.genre[0]}</p>
                    </div>
                  </div>
                  <button onClick={() => addToWatchlist(movie)} className="mt-auto bg-slate-700 hover:bg-purple-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    <IconPlus className="w-3 h-3" /> Adicionar
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );

  const renderWatchlist = () => {
    if (movies.length === 0 && searchQuery === "") {
        return (
          <div className="flex flex-col items-center justify-center h-96 space-y-4 animate-in fade-in zoom-in duration-500">
             <div className="bg-slate-800 p-6 rounded-full"><IconFilm className="w-12 h-12 text-slate-500" /></div>
             <h2 className="text-2xl font-bold text-white">Sua lista está vazia</h2>
             <p className="text-slate-400 text-center max-w-sm">Comece adicionando filmes que vocês querem ver juntos.</p>
             <button onClick={() => setCurrentView(ViewMode.SEARCH)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
               <IconSearch className="w-5 h-5" /> Buscar Filmes
             </button>
          </div>
        );
    }
    
    return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Minha Lista</h2>
            <p className="text-slate-400">Total: {rawWatchList.length} filmes</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             <button className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap" onClick={() => setCurrentView(ViewMode.SEARCH)}>
              <IconPlus className="w-4 h-4" /> Novo
            </button>
            <button onClick={() => { const r = rawWatchList[Math.floor(Math.random() * rawWatchList.length)]; if(r) setRandomMovie(r); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap">
              <IconDice className="w-4 h-4" /> Roleta
            </button>
            <button onClick={startBattle} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap">
              <IconSwords className="w-4 h-4" /> Batalha
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
           <div className="flex items-center gap-2 border-r border-slate-600 pr-3">
             <IconSort className="w-4 h-4 text-slate-400" />
             <select value={watchlistSort} onChange={(e) => setWatchlistSort(e.target.value as SortOption)} className="bg-transparent text-sm text-slate-200 outline-none">
               <option value={SortOption.DATE_DESC}>Recentes</option>
               <option value={SortOption.TITLE_ASC}>A-Z</option>
               <option value={SortOption.YEAR_DESC}>Lançamento</option>
             </select>
           </div>
           <div className="flex items-center gap-2">
             <IconTV className="w-4 h-4 text-slate-400" />
             <select value={streamingFilter} onChange={(e) => setStreamingFilter(e.target.value as any)} className="bg-transparent text-sm text-slate-200 outline-none">
               <option value="ALL">Todos os Streamings</option>
               {STREAMING_PLATFORMS.map(p => <option key={p} value={p || ''}>{p}</option>)}
             </select>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedWatchlist.slice(0, visibleWatchlistCount).map(movie => (
          <div key={movie.id} className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col h-full relative group">
            <div className="relative h-48">
              <img src={getImageUrl(movie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
              {activeChallengeId === movie.id && (
                <div className="absolute top-2 left-2 bg-rose-600 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-lg animate-pulse">
                   <IconTarget className="w-3 h-3"/> Desafio Ativo
                </div>
              )}
              <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                <div>
                  <h3 className="text-xl font-bold text-white shadow-black drop-shadow-md truncate w-48">{movie.title}</h3>
                  <p className="text-rose-300 text-sm font-medium">{movie.year}</p>
                </div>
                {movie.platform && (
                  <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded border border-white/20 backdrop-blur-sm">
                    {movie.platform}
                  </span>
                )}
              </div>
               <button onClick={() => setEditingMovie(movie)} className="absolute top-2 right-10 bg-black/50 text-white p-1.5 rounded-full hover:bg-blue-600 opacity-0 group-hover:opacity-100 transition-all">
                <IconEdit className="w-3 h-3" />
              </button>
              <button onClick={() => removeMovie(movie.id)} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-all">
                <IconTrash className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                 <div className="flex gap-1 flex-wrap">
                    {movie.genre.slice(0,2).map(g => <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{g}</span>)}
                 </div>
                 {/* Who picked toggle */}
                 <div 
                  onClick={() => updateMovie(movie.id, { pickedBy: movie.pickedBy === 'A' ? 'B' : movie.pickedBy === 'B' ? null : 'A' })}
                  className={`cursor-pointer w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${movie.pickedBy === 'A' ? 'bg-blue-500 border-blue-400' : movie.pickedBy === 'B' ? 'bg-pink-500 border-pink-400' : 'bg-slate-700 border-slate-600 text-slate-500'}`}
                  title="Quem escolheu?"
                 >
                   {movie.pickedBy || '?'}
                 </div>
              </div>
              <p className="text-slate-400 text-sm line-clamp-2 mb-4 flex-1">{movie.description}</p>
              
              {!movie.platform && (
                 <div className="mb-3">
                   <select 
                     onChange={(e) => updateMovie(movie.id, { platform: e.target.value as StreamingPlatform })}
                     className="w-full bg-slate-900/50 text-xs text-slate-400 border border-slate-700 rounded p-1 outline-none"
                   >
                     <option value="">Onde assistir?</option>
                     {STREAMING_PLATFORMS.map(p => <option key={p} value={p || ''}>{p}</option>)}
                   </select>
                 </div>
              )}

              <button onClick={() => setRatingModalMovie(movie)} className="w-full bg-slate-700 hover:bg-rose-600 text-white py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <IconCheck className="w-4 h-4" /> Marcar Visto
              </button>
            </div>
          </div>
        ))}
      </div>
       {visibleWatchlistCount < sortedWatchlist.length && (
          <div className="flex justify-center mt-6">
            <button onClick={() => setVisibleWatchlistCount(prev => prev + ITEMS_PER_PAGE)} className="bg-slate-800 text-slate-300 px-6 py-2 rounded-lg text-sm border border-slate-600">Carregar Mais</button>
          </div>
        )}
    </div>
  )};

  const renderRated = () => {
    if (rawWatchedMovies.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-4 animate-in fade-in zoom-in duration-500">
             <div className="bg-slate-800 p-6 rounded-full"><IconStar className="w-12 h-12 text-slate-500" /></div>
             <h2 className="text-2xl font-bold text-white">Nenhum filme avaliado</h2>
             <p className="text-slate-400 text-center max-w-sm">Os filmes que vocês marcarem como vistos aparecerão aqui.</p>
             <button onClick={() => setCurrentView(ViewMode.WATCHLIST)} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
               Ir para Lista
             </button>
        </div>
      )
    }

    return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-white">Nosso Diário</h2>
        <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
           <IconSort className="w-4 h-4 text-slate-400" />
           <select value={ratedSort} onChange={(e) => setRatedSort(e.target.value as SortOption)} className="bg-transparent text-sm text-slate-200 outline-none">
             <option value={SortOption.DATE_DESC}>Recentes</option>
             <option value={SortOption.RATING_DESC}>Melhores Notas</option>
           </select>
        </div>
      </div>

      <div className="space-y-4">
        {sortedRated.slice(0, visibleRatedCount).map(movie => (
           <div key={movie.id} className="bg-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 relative group border border-slate-700 hover:border-slate-600 transition-colors">
              <img src={getImageUrl(movie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full md:w-24 h-36 object-cover rounded-lg shadow-md flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                   <div>
                     <h3 className="text-lg font-bold text-white truncate">{movie.title}</h3>
                     <p className="text-slate-400 text-xs">{new Date(movie.watchedAt!).toLocaleDateString()} • {movie.year}</p>
                   </div>
                   <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded text-yellow-500">
                     <span className="font-bold">{movie.rating}</span> <IconStar className="w-3 h-3" fill />
                   </div>
                </div>
                
                {/* Review with Spoiler Guard */}
                <div className="relative mt-2 group/review cursor-pointer">
                  <p className={`text-slate-300 text-sm italic border-l-2 border-slate-600 pl-3 py-1 ${(movie.userReview?.length || 0) > 50 ? 'blur-sm group-hover/review:blur-0 transition-all' : ''}`}>
                    {movie.userReview || "Sem comentário."}
                  </p>
                  {(movie.userReview?.length || 0) > 50 && (
                    <div className="absolute inset-0 flex items-center justify-center group-hover/review:opacity-0 pointer-events-none">
                      <div className="bg-black/60 px-2 py-1 rounded text-xs text-white flex gap-1 items-center"><IconEyeOff className="w-3 h-3"/> Spoiler?</div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2 justify-end">
                   <button onClick={() => handleShare(movie)} className="text-xs bg-slate-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1"><IconShare className="w-3 h-3"/> Story</button>
                   <button onClick={() => removeMovie(movie.id)} className="text-xs text-slate-500 hover:text-rose-500 px-2">Remover</button>
                </div>
              </div>
           </div>
        ))}
         {visibleRatedCount < sortedRated.length && (
          <div className="flex justify-center mt-6">
            <button onClick={() => setVisibleRatedCount(prev => prev + ITEMS_PER_PAGE)} className="bg-slate-800 text-slate-300 px-6 py-2 rounded-lg text-sm border border-slate-600">Carregar Mais</button>
          </div>
        )}
      </div>
    </div>
  )};

  const renderSettings = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white">Configurações & Dados</h2>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
        <div>
           <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-2"><IconSettings className="w-5 h-5"/> Integração TMDB (API Key)</h3>
           <p className="text-slate-400 text-sm mb-3">Necessário para buscar filmes e capas. Crie sua chave gratuita em <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-rose-500 hover:underline">themoviedb.org</a>.</p>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={tmdbKey} 
               onChange={(e) => setTmdbKey(e.target.value)} 
               placeholder="Cole sua API Key da TMDB aqui"
               className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-rose-500 outline-none"
             />
             <button onClick={() => saveTmdbKey(tmdbKey)} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg font-bold">Salvar</button>
           </div>
        </div>

        <div className="border-t border-slate-700 pt-6">
           <h3 className="text-lg font-medium text-white flex items-center gap-2"><IconDownload className="w-5 h-5"/> Exportar Backup</h3>
           <p className="text-slate-400 text-sm mb-3">Salve todos os seus filmes e avaliações em um arquivo seguro.</p>
           <button onClick={exportData} className="bg-slate-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
             Baixar JSON
           </button>
        </div>
        <div className="border-t border-slate-700 pt-6">
           <h3 className="text-lg font-medium text-white flex items-center gap-2"><IconUpload className="w-5 h-5"/> Importar Backup</h3>
           <p className="text-slate-400 text-sm mb-3">Restaure seus dados de um arquivo anterior.</p>
           <input ref={fileInputRef} type="file" accept=".json" onChange={importData} className="hidden" />
           <button onClick={() => fileInputRef.current?.click()} className="bg-slate-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
             Selecionar Arquivo
           </button>
        </div>
        <div className="border-t border-slate-700 pt-6">
           <p className="text-xs text-slate-500 text-center">CineCasal v1.3 • Powered by TMDB</p>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ mode, icon: Icon, label }: { mode: ViewMode, icon: any, label: string }) => (
    <button
      onClick={() => setCurrentView(mode)}
      className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all w-full md:w-auto ${
        currentView === mode 
          ? 'text-rose-500 bg-rose-500/10 font-medium' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      <Icon className={`w-6 h-6 md:w-5 md:h-5 ${currentView === mode ? 'fill-current opacity-20' : ''}`} />
      <span className="text-[10px] md:text-sm mt-1 md:mt-0">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-rose-500/30">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => <Toast key={t.id} type={t.type} message={t.message} onClose={() => removeToast(t.id)} />)}
      </div>

      <div className="md:flex min-h-screen max-w-7xl mx-auto">
        <nav className="fixed md:sticky bottom-0 left-0 right-0 md:top-0 md:h-screen bg-slate-950/90 md:bg-slate-950 backdrop-blur-lg border-t md:border-t-0 md:border-r border-slate-800 z-40 md:w-64 flex-shrink-0">
          <div className="flex md:flex-col h-full p-2 md:p-6 justify-around md:justify-start gap-1 md:gap-2">
            <div className="hidden md:flex items-center gap-3 mb-8 px-2">
              <div className="bg-rose-600 p-2 rounded-lg"><IconHeart className="w-6 h-6 text-white" /></div>
              <span className="text-xl font-bold tracking-tight">CineCasal</span>
            </div>
            <NavItem mode={ViewMode.DASHBOARD} icon={IconHome} label="Início" />
            <NavItem mode={ViewMode.WATCHLIST} icon={IconList} label="Para Ver" />
            <NavItem mode={ViewMode.RATED} icon={IconStar} label="Diário" />
            <NavItem mode={ViewMode.SETTINGS} icon={IconSettings} label="Ajustes" />
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-x-hidden">
           {currentView === ViewMode.DASHBOARD && renderDashboard()}
           {currentView === ViewMode.WATCHLIST && renderWatchlist()}
           {currentView === ViewMode.RATED && renderRated()}
           {currentView === ViewMode.SEARCH && (
              <div className="max-w-3xl mx-auto space-y-6">
                 <h2 className="text-2xl font-bold text-center">Adicionar Filme</h2>
                 <form onSubmit={(e) => { e.preventDefault(); /* handled by effect */ }}>
                    <div className="relative">
                       <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Digite o nome..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 pl-12 text-lg text-white focus:border-rose-500 outline-none" autoFocus />
                       <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                       <div className="absolute right-4 top-1/2 -translate-y-1/2">{isSearching && <IconLoader className="text-rose-500" />}</div>
                    </div>
                 </form>
                 {!tmdbKey && <div className="text-center text-rose-400 text-sm">Configure a API Key da TMDB nos Ajustes para buscar.</div>}
                 <div className="space-y-3">
                   {searchResults.map((r, i) => (
                      <div key={i} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex gap-4 hover:border-rose-500/50 cursor-pointer" onClick={() => addToWatchlist(r)}>
                        <div className="w-12 h-16 bg-slate-700 rounded shrink-0 overflow-hidden"><img src={getImageUrl(r.posterPath)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-full object-cover" /></div>
                        <div><h3 className="font-bold">{r.title}</h3><p className="text-xs text-slate-400">{r.year} • {r.genre.join(', ')}</p><p className="text-xs text-slate-500 line-clamp-1">{r.description}</p></div>
                        <button className="ml-auto bg-slate-700 hover:bg-rose-600 rounded-full p-2 h-fit self-center"><IconPlus className="w-4 h-4 text-white" /></button>
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
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 animate-in zoom-in duration-300">
           <h2 className="text-3xl font-black text-white mb-8 uppercase tracking-widest flex items-center gap-4"><IconSwords className="w-8 h-8 text-orange-500"/> Batalha de Filmes <IconSwords className="w-8 h-8 text-orange-500 scale-x-[-1]"/></h2>
           <div className="flex flex-col md:flex-row gap-8 items-center">
              <div onClick={() => handleBattlePick(battleMovies[0])} className="group cursor-pointer bg-slate-800 border-2 border-slate-700 hover:border-rose-500 hover:scale-105 transition-all p-4 rounded-2xl w-64 text-center">
                 <img src={getImageUrl(battleMovies[0].imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-80 object-cover rounded-xl mb-4 shadow-2xl" />
                 <h3 className="font-bold text-xl">{battleMovies[0].title}</h3>
              </div>
              <div className="text-2xl font-bold text-slate-500">VS</div>
              <div onClick={() => handleBattlePick(battleMovies[1])} className="group cursor-pointer bg-slate-800 border-2 border-slate-700 hover:border-blue-500 hover:scale-105 transition-all p-4 rounded-2xl w-64 text-center">
                 <img src={getImageUrl(battleMovies[1].imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-80 object-cover rounded-xl mb-4 shadow-2xl" />
                 <h3 className="font-bold text-xl">{battleMovies[1].title}</h3>
              </div>
           </div>
           <button onClick={() => setBattleMovies(null)} className="mt-12 text-slate-500 hover:text-white">Cancelar Batalha</button>
        </div>
      )}

      {/* Random Pick Overlay */}
      {randomMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-slate-800 border border-indigo-500/50 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500"></div>
            <IconDice className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">{randomMovie.title}</h2>
            <img src={getImageUrl(randomMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-32 h-48 object-cover rounded-lg shadow-lg mb-6 mx-auto" />
            <div className="flex gap-3">
              <button onClick={() => setRandomMovie(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700">Fechar</button>
              <button onClick={() => { setRandomMovie(null); setRatingModalMovie(randomMovie); }} className="flex-1 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500">Assistir</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Story Template */}
      {sharingMovie && (
         <div ref={storyRef} style={{position: 'fixed', top: 0, left: '-9999px', width: '540px', height: '960px', zIndex: -10}} className="bg-slate-900 flex flex-col relative overflow-hidden text-white">
            <div className="absolute inset-0 z-0"><img src={getImageUrl(sharingMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-full h-full object-cover opacity-30 blur-xl scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-950/60" /></div>
            <div className="relative z-10 flex flex-col h-full p-8 items-center justify-between text-center">
               <div className="mt-8 flex items-center gap-3 bg-rose-600/90 px-6 py-2 rounded-full"><IconHeart className="w-6 h-6 text-white" /><span className="font-bold">CineCasal Review</span></div>
               <div className="flex flex-col items-center w-full gap-6">
                  <div className="p-3 bg-white/5 rounded-2xl rotate-1 shadow-2xl"><img src={getImageUrl(sharingMovie.imageUrl)} crossOrigin="anonymous" onError={handleImageError} className="w-64 h-96 object-cover rounded-xl" /></div>
                  <div><h1 className="text-4xl font-black text-white mb-2">{sharingMovie.title}</h1><p className="text-rose-300 text-lg">{sharingMovie.year}</p></div>
                  <div className="flex gap-2 text-yellow-400">{[1,2,3,4,5].map(s => <IconStar key={s} className="w-10 h-10" fill={s <= (sharingMovie.rating||0)} />)}</div>
               </div>
               <div className="mb-12 bg-slate-800/80 p-8 rounded-3xl backdrop-blur-md w-full"><p className="text-xl italic text-slate-100">"{sharingMovie.userReview}"</p></div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
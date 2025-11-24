import React, { useState } from 'react';
import { Movie } from '../types';
import { IconStar } from './Icons';

interface RatingModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, rating: number, review: string) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ movie, isOpen, onClose, onSave }) => {
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [hoverRating, setHoverRating] = useState<number>(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(movie.id, rating, review);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-rose-600 p-4 text-white">
          <h2 className="text-xl font-bold truncate">Avaliar: {movie.title}</h2>
          <p className="text-rose-100 text-sm opacity-90">O que vocês acharam?</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">Sua Nota</span>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="transition-transform hover:scale-110 focus:outline-none"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <IconStar
                    className={`w-10 h-10 ${
                      (hoverRating || rating) >= star
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-slate-600'
                    }`}
                    fill={(hoverRating || rating) >= star}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wider">Comentário do Casal</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors resize-none h-32"
              placeholder="Ex: Eu chorei no final, ele dormiu..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={rating === 0}
              className={`flex-1 py-2 px-4 rounded-lg font-medium shadow-lg transition-all ${
                rating === 0 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-rose-600 text-white hover:bg-rose-500 hover:shadow-rose-500/25'
              }`}
            >
              Salvar Avaliação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
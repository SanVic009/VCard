import { useState, useEffect, useCallback } from 'react';
import { getCards, CardResponse } from '../lib/cardsApi';

export function useCards() {
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getCards();
      setCards(data.cards);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to load cards";
      setError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return { cards, loading, error, refresh: fetchCards };
}

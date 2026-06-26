import { useState, useEffect, useCallback } from 'react';
import { getCards, CardResponse } from '../lib/cardsApi';

export function useCards() {
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async (silent = false, search?: string) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getCards(search);
      setCards(data.cards);
      return data.cards;
    } catch (err: any) {
      const message = err.message || "Failed to load cards";
      setError(message);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);



  return { cards, loading, error, refresh: fetchCards };
}

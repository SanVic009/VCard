import { useState, useEffect, useCallback } from 'react';
import { getCard, CardResponse } from '../lib/cardsApi';

export function useCard(cardId: string) {
  const [card, setCard] = useState<CardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async (background = false) => {
    if (!cardId) return;
    try {
      if (!background) setLoading(true);
      setError(null);
      const data = await getCard(cardId);
      setCard(data);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to load card";
      setError(message);
    } finally {
      if (!background) setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  return { card, loading, error, refresh: fetchCard };
}

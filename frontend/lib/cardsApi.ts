import api from './api';

export interface CardCreate {
  name?: string | null;
  title?: string | null;
  company?: string | null;
  address?: string | null;
  emails?: string[];
  phones?: string[];
  websites?: string[];
  image_url?: string | null;
  raw_extraction?: string | null;
}

export interface CardUpdate {
  name?: string | null;
  title?: string | null;
  company?: string | null;
  address?: string | null;
  emails?: string[];
  phones?: string[];
  websites?: string[];
  raw_extraction?: string | null;
}

export interface CardResponse {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  name: string | null;
  title: string | null;
  company: string | null;
  address: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  company_id: string | null;
  raw_extraction: string | null;
}


export interface CardListResponse {
  cards: CardResponse[];
  total: number;
}

export const createCard = async (data: CardCreate): Promise<CardResponse> => {
  const response = await api.post<CardResponse>('/cards', data);
  return response.data;
};

export const getCards = async (search?: string): Promise<CardListResponse> => {
  const response = await api.get<CardListResponse>('/cards', {
    params: search ? { search } : undefined
  });
  return response.data;
};

export const getCard = async (id: string): Promise<CardResponse> => {
  const response = await api.get<CardResponse>(`/cards/${id}`);
  return response.data;
};

export const updateCard = async (id: string, data: CardUpdate): Promise<CardResponse> => {
  const response = await api.patch<CardResponse>(`/cards/${id}`, data);
  return response.data;
};

export const deleteCard = async (id: string): Promise<void> => {
  await api.delete(`/cards/${id}`);
};

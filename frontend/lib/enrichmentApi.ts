import api from './api';

export interface EnrichmentStatus {
  status: 'pending' | 'completed' | 'failed';
  company_id: string | null;
}

export interface CompanyDetail {
  id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
  website: string | null;
  location: string | null;
  products: Array<{ name: string; description?: string }>;
  services: Array<{ name: string; description?: string }>;
  technologies: string[];
  enrichment_status: 'pending' | 'completed' | 'failed';
  enrichment_error: string | null;
  card_id: string | null;
}

export const enrichCard = async (cardId: string): Promise<void> => {
  await api.post('/enrichment/enrich', { card_id: cardId });
};

export const getEnrichmentStatus = async (cardId: string): Promise<EnrichmentStatus> => {
  const response = await api.get<EnrichmentStatus>(`/enrichment/status/${cardId}`);
  return response.data;
};

export const getCompanyDetail = async (companyId: string): Promise<CompanyDetail> => {
  const response = await api.get<CompanyDetail>(`/enrichment/company/${companyId}`);
  return response.data;
};

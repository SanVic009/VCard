import api from './api';

export interface ExtractionResponse {
  success: boolean;
  data: ExtractionData | null;
  error: string | null;
}

export interface ExtractionData {
  name: string | null;
  title: string | null;
  company: string | null;
  address: string | null;
  emails: string[];
  phones: string[];
  websites: string[];
  raw_extraction: string;
}

export interface ImagePayload {
  image_base64: string;
  mime_type: string;
}

export const extractBusinessCard = async (
  images: ImagePayload[]
): Promise<ExtractionResponse> => {
  try {
    const response = await api.post('/extraction/extract', {
      images,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      return error.response.data;
    }
    return {
      success: false,
      data: null,
      error: error.message || 'An unexpected error occurred during extraction.',
    };
  }
};

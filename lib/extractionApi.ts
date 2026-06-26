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

export const extractBusinessCard = async (
  imageBase64: string,
  mimeType: string
): Promise<ExtractionResponse> => {
  try {
    const response = await api.post('/extraction/extract', {
      image_base64: imageBase64,
      mime_type: mimeType,
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

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface User {
  user_id: string;
  email: string;
  password: string;
  username: string;
  created_at: Date;
}

export interface CardData {
  name: string;
  title: string;
  company: string;
  address: string;
  emailid: string;
  website: string;
  phone: string;
}

export interface Job {
  job_id: string;
  user_id: string;
  filename: string;
  file_path: string;
  status: JobStatus;
  error_message: string | null;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CardDataRecord extends CardData {
  job_id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CardImageRecord {
  job_id: string;
  user_id: string;
  image_path: string;
  image_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface GenerateResponse {
  success: boolean;
  email: string;
  expiresAt: number | null;
  recoveryToken?: string;
  message?: string;
  isPermanent?: boolean;
}

export interface AliasData {
  email: string;
  expiresAt: number | null;
  recoveryToken?: string;
  isPermanent?: boolean;
}

export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  html: string;
  receivedAt: number;
}
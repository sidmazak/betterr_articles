export interface PublishMetadata {
  excerpt?: string;
  tags?: string[];
  slug?: string;
  seoTitle?: string;
  metaDescription?: string;
  category?: string;
  canonicalUrl?: string | null;
  socialHashtags?: string[];
  coverImageBase64?: string | null;
  coverImageMimeType?: string | null;
  coverImageAlt?: string | null;
}

export interface PublishPayload {
  title: string;
  content: string;
  metadata?: PublishMetadata;
}

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PublisherConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface PublisherAdapter {
  publish: (config: Record<string, unknown>, payload: PublishPayload) => Promise<PublishResult>;
  testConnection: (config: Record<string, unknown>) => Promise<PublisherConnectionResult>;
}

export interface PublishTargetResult extends PublishResult {
  configId: string;
  platform: string;
  label: string;
}

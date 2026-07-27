export const URL_CONTENT_EXTRACTOR_PORT = Symbol('URL_CONTENT_EXTRACTOR_PORT');

export type ExtractedUrlContent = {
  url: string;
  title?: string;
  text: string;
};

export interface UrlContentExtractorPort {
  extract(url: string): Promise<ExtractedUrlContent>;
}

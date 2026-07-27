export interface ImageAsset {
  id: string;
  phash: string;
  url: string;
  favorite: boolean;
  usages: number;
  score: number;
  categories: string[];
  tags: string[];
  created_at: string;
}

export type Cycle = {
  start_date: string;
  cycle_length_days: number;
  period_length_days: number;
};

export type Article = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  // Nhóm B (v4): cover_url do getPostsByTopic trả về (kiểu Post),
  // để ArticleCard hiển thị ảnh cover ở đầu thẻ.
  cover_url?: string | null;
};

export type Flow = 'light' | 'medium' | 'heavy' | null;

export type CycleLog = {
  log_date: string;
  has_period: boolean;
  flow: Flow;
  symptoms: string[];
  spotting: boolean;
};

export type MutationEntry = {
  method: string;
  path: string;
  status: number;
  ok: boolean;
  at: string;
};

export type ProjectListItem = {
  id: number;
  item_id: number;
  name: string;
  domain: string;
  parent_id: number;
};

export type ProjectJob = {
  id: number;
  started_at: string;
  finished_at: string;
  user_id: number;
  project_id: number;
  status: number;
  autolaunch_type: number;
  all_tasks_issued_at: string;
  country: string;
  project_separate_balance_enabled: boolean;
  device: number;
};

export type Autolaunch = {
  project_id: number;
  active: boolean;
  pos_check_freq_mins: number;
  click_freq_mins: number;
  target_pos: number;
  budget: number;
  error: string;
  provider: string;
  start_pos: number;
  type: number;
  device: number;
  adaptive_max_target_count: number;
  use_recommendations: boolean;
  click_target_pos: boolean;
  updated_at: string;
  adaptive_start_target_count: number;
  adaptive_start_check_freq_mins: number;
  use_brand_click: boolean;
  brand: string;
  user_id: number;
  adaptive_min_check_freq_mins: number;
  allow_demo_yaxml: boolean;
  adaptive_click_target_pos: boolean;
  speed_up_adaptive_start: boolean;
  brand_start_pos: number;
  brand_finish_pos: number;
  positions_device: number;
};

export type ProjectTops = {
  project_id: number;
  updated_at: string;
  top_1: number;
  top_3: number;
  top_5: number;
  top_10: number;
  top_20: number;
  top_30: number;
  top_100: number;
  beyond_top_100: number;
  delta_top_1: number;
  delta_top_3: number;
  delta_top_5: number;
  delta_top_10: number;
  delta_top_20: number;
  delta_top_30: number;
  delta_top_100: number;
  delta_beyond_top_100: number;
  avg_position: number;
  first_avg_position: number;
  delta_avg_position: number;
  keywords_count: number;
};

export type Project = {
  id: number;
  created_at: string;
  user_id: number;
  item_id: number;
  name: string;
  domain: string;
  region: number;
  external_id: number | null;
  new_keywords_url: string;
  deleted_at: string | null;
  budget_exceeded: boolean;
  expert_mode: boolean;
  send_report: boolean;
  send_daily: boolean;
  send_weekly: boolean;
  category_limit_main_campaign: number;
  category_limit_test_success: number;
  category_limit_testing: number;
  category_limit_testing_percent: number;
  category_auto_main_campaign: boolean;
  separate_balance_enabled: boolean;
  last_job_id: number;
  last_positions_job_id: number;
  dynamic_semantics_enabled: boolean;
  use_main_balance_for_testing: boolean;
  had_pc_profiles: boolean;
  auto_load_queries: boolean;
  keywords: number;
  total_spent: number;
  period_spent: number;
  last_done_counts: number;
  last_spent: number;
  total_done_counts: number;
  period_done_counts: number;
  usage_counts: number;
  usage_counts_limits: number;
  last_job: ProjectJob;
  autolaunch_settings: Autolaunch;
  project_tops: ProjectTops;
  last_positions_error: string;
};

export type CatalogKeywords = {
  keywords_count: number;
  test_keywords_count: number;
  keywords_in_promotion: number;
  top_1: number;
  top_3: number;
  top_10: number;
  delta_top_1: number;
  delta_top_3: number;
  delta_top_10: number;
  avg_position: number;
  first_avg_position: number;
  delta_avg_position: number;
};

/** Spend fields `total_money_spent` / `period_money_spent` are kopecks. `total_spent` / `period_spent` are click counts. */
export type CatalogProjectInfo = {
  id: number;
  user_id: number;
  name: string;
  domain: string;
  region: number;
  external_id: number | null;
  created_at: string;
  deleted_at: string | null;
  expert_mode: boolean;
  separate_balance_enabled: boolean;
  total_spent: number;
  period_spent: number;
  total_money_spent: number;
  period_money_spent: number;
  total_positions_money_spent: number;
  period_positions_money_spent: number;
  last_done_counts: number;
  total_done_counts: number;
  period_done_counts: number;
  today_done_counts: number;
  usage_counts: number;
  usage_counts_limits: number;
  last_positions_error: string;
  active_since: string | null;
  last_job: { status: number; started_at: string };
  is_valid_region: boolean;
  separate_balance: {
    balance: number;
    allocated_balance: number;
    is_low: boolean;
    days_remaining: number;
    demo_balance: number;
    money_balance: number;
  };
  total_monthly_price: number;
  autolaunch_settings: Partial<Autolaunch> & { project_id: number; active: boolean };
};

export type CatalogItem = {
  id: number;
  parent_id: number | null;
  type: 'folder' | 'project' | string;
  name: string;
  created_at?: string;
  children_count: number;
  children?: CatalogItem[];
  keywords?: CatalogKeywords;
  project_info?: CatalogProjectInfo;
};

export type PositionCheck = {
  time: string;
  provider: string;
  position: number;
  pc_position: number;
  mobile_position: number;
  delta: number;
  found_url: string;
  errors_count: number;
  position_id: number;
};

export type KeywordV2 = {
  id: number;
  user_id: number;
  project_id: number;
  created_at: string;
  updated_at: string;
  text: string;
  enabled: boolean;
  target_count: number;
  month_count: number;
  adaptive_interval_mins: number;
  adaptive_checked_at: string | null;
  adaptive_interval_set: boolean;
  target_pos: number | null;
  external_id: number | null;
  optimised_at: string | null;
  start_pos: number | null;
  url: string;
  adaptive_target_pos_set_at: string | null;
  adaptive_target_pos_changed_delta: number | null;
  adaptive_target_pos: number | null;
  simple_interval_mins: number | null;
  max_target_count: number | null;
  min_adaptive_interval_mins: number | null;
  adaptive_start_pos: number;
  external_budget_rub: number | null;
  gather_positions_while_disabled: boolean;
  adaptive_started_at: string | null;
  use_url: boolean;
  category: number;
  category_updated_at: string;
  category_main_campaign_forced_from: string | null;
  frequency: number;
  frequency_updated_at: string;
  test_completed_at: string;
  last_completed_at: string | null;
  frequency_strict: number;
  frequency_strict_updated_at: string;
  cpc: number | null;
  cpc_updated_at: string | null;
  monthly_price_kopecks: number | null;
  checks?: PositionCheck[];
};

export type PositionsResponse = {
  result?: KeywordV2[];
  total?: number;
  keywords?: KeywordV2[];
};

export type PositionsJob = {
  id: number;
  started_at: string;
  user_id: number;
  project_id: number;
  status: number;
  error: string;
  provider: string;
  manual_launch: boolean;
  raw_error: string;
  device: number;
};

export type Balance = {
  user_id: number;
  billing_type: string;
  money_balance: number;
  test_balance: number;
  referals_money: number;
  click_price: number;
  approx_clicks: number;
  has_dynamic_semantics: boolean;
};

export type BalanceDetailed = {
  balance: {
    current_balance: number;
    projects_balance_sum: number;
    average_daily_clicks_spend: number;
    average_daily_money_spend: number;
    average_daily_positions_money_spend: number;
    monthly_clicks_forecast: number;
    monthly_money_forecast: number;
    days_remaining: number;
    forecast_state: string;
    money_balance: number;
    billing_type: string;
    monthly_budget_kopecks: number;
    daily_budget_kopecks: number;
    projects_money_balance_sum: number;
    click_price: number;
    approx_clicks: number;
  };
  tariffs: Record<string, unknown>;
};

export type BillingCounters = {
  status: number;
  body: string;
};

export type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
};

export type CreateProjectBody = {
  name: string;
  domain: string;
  region: number;
  provider: string;
  device: number;
  new_keywords_url?: string;
  send_report?: boolean;
  dynamic_semantics_enabled?: boolean;
  category_auto_main_campaign?: boolean;
  use_main_balance_for_testing?: boolean;
  parent_id?: number;
};

export type CopyProjectBody = {
  project_id: number;
  name: string;
  region: number;
};

export type UpdateProjectBody = {
  name?: string;
  domain?: string;
  region?: number;
  provider?: string;
  new_keywords_url?: string;
  send_report?: boolean;
};

export type CreateFolderBody = {
  name: string;
  parent_id?: number;
  children_ids?: number[] | null;
  target_id?: number | null;
};

export type MoveCatalogBody = {
  parent_id: number;
  target_id?: number | null;
};

export type KeywordsFieldBody = {
  ids: number[];
  field: string;
  value: unknown;
};

export type DateRange = {
  from?: string;
  to?: string;
};

export type KeywordsPageQuery = {
  offset: number;
  limit: number;
  from?: string;
  to?: string;
};

export type BillingKind = 'income' | 'expense' | 'in_promotion';

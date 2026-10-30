# Response shapes (types only, values stripped) from recon samples 2026-10-30

## balance_detailed_v2.json
```json
{
 "balance": {
  "current_balance": "int",
  "projects_balance_sum": "int",
  "average_daily_clicks_spend": "int",
  "average_daily_money_spend": "int",
  "average_daily_positions_money_spend": "int",
  "monthly_clicks_forecast": "int",
  "monthly_money_forecast": "int",
  "days_remaining": "int",
  "forecast_state": "str",
  "money_balance": "int",
  "billing_type": "str",
  "monthly_budget_kopecks": "int",
  "daily_budget_kopecks": "int",
  "projects_money_balance_sum": "int",
  "click_price": "int",
  "approx_clicks": "int"
 },
 "tariffs": {
  "has_first_payment": "bool",
  "use_personal_tariffs": "bool",
  "use_money_in_personal_tariffs": "bool",
  "comment": "str",
  "user_info": {
   "inn": "int",
   "ogr_name": "str",
   "contract_num": "str",
   "crypto_payment_available": "bool"
  },
  "personal_clicks_tariffs": {
   "tariffs": [
    {
     "id": "int",
     "name": "str",
     "is_default": "bool",
     "task_cost": "int",
     "money_amount": "int",
     "is_personal": "bool",
     "month_spent_amount": "int",
     "personal_use_money": "bool"
    }
   ],
   "prev_month_spent": "int",
   "current_month_spent": "int",
   "current_month_next_threshold": "int",
   "current_month_click_price": "int",
   "next_month_click_price": "int",
   "next_month_next_click_price": "int",
   "tariff_found": "bool"
  },
  "personal_money_tariffs": {
   "tariffs": [
    {
     "id": "int",
     "name": "str",
     "is_default": "bool",
     "task_cost": "int",
     "money_amount": "int",
     "is_personal": "bool",
     "month_spent_amount": "int",
     "personal_use_money": "bool"
    }
   ],
   "prev_month_spent": "int",
   "current_month_spent": "int",
   "current_month_next_threshold": "int",
   "current_month_click_price": "int",
   "next_month_click_price": "int",
   "next_month_next_click_price": "int",
   "tariff_found": "bool"
  },
  "common_money_tariffs": {
   "tariffs": [
    {
     "id": "int",
     "name": "str",
     "is_default": "bool",
     "task_cost": "int",
     "money_amount": "int",
     "is_personal": "bool",
     "month_spent_amount": "int",
     "personal_use_money": "bool"
    }
   ],
   "prev_month_spent": "int",
   "current_month_spent": "int",
   "current_month_next_threshold": "int",
   "current_month_click_price": "int",
   "next_month_click_price": "int",
   "next_month_next_click_price": "int",
   "tariff_found": "bool"
  }
 }
}
```

## billingCounters.json
```json
{
 "status": "int",
 "body": "str"
}
```

## budget_exceeded.json
```json
{
 "error": "str",
 "error_raw": "str",
 "result": "int",
 "total": "int"
}
```

## desktop_available.json
```json
{
 "available": "bool"
}
```

## fixed_tariff.json
```json
{
 "view": {
  "tariff": "NoneType",
  "next_tariff": "NoneType",
  "requests_used": "int"
 }
}
```

## kb_navigation.json
```json
{
 "status": "int",
 "body": "str"
}
```

## keywords_table_settings.json
```json
{
 "available_static_columns": [
  {
   "key": "str",
   "title": "str"
  }
 ],
 "disabled_static_columns": [
  "str"
 ],
 "disabled_dynamic_columns": {
  "527052": []
 }
}
```

## lkUsers.json
```json
{
 "status": "int",
 "body": "str"
}
```

## positions_527041_full_range.json
```json
{
 "status": "int",
 "size": "int",
 "head": "str",
 "datesMin": "str",
 "datesMax": "str",
 "distinctDates": "int"
}
```

## positions_544055_september.json
```json
{
 "status": "int",
 "size": "int",
 "head": "str",
 "datesMin": "str",
 "datesMax": "str",
 "distinctDates": "int"
}
```

## project_544055.json
```json
{
 "id": "int",
 "created_at": "str",
 "user_id": "int",
 "item_id": "int",
 "name": "str",
 "domain": "str",
 "region": "int",
 "external_id": "NoneType",
 "new_keywords_url": "str",
 "deleted_at": "NoneType",
 "budget_exceeded": "bool",
 "expert_mode": "bool",
 "send_report": "bool",
 "send_daily": "bool",
 "send_weekly": "bool",
 "category_limit_main_campaign": "int",
 "category_limit_test_success": "int",
 "category_limit_testing": "int",
 "category_limit_testing_percent": "int",
 "category_auto_main_campaign": "bool",
 "separate_balance_enabled": "bool",
 "last_job_id": "int",
 "last_positions_job_id": "int",
 "dynamic_semantics_enabled": "bool",
 "use_main_balance_for_testing": "bool",
 "had_pc_profiles": "bool",
 "auto_load_queries": "bool",
 "keywords": "int",
 "total_spent": "int",
 "period_spent": "int",
 "last_done_counts": "int",
 "last_spent": "int",
 "total_done_counts": "int",
 "period_done_counts": "int",
 "usage_counts": "int",
 "usage_counts_limits": "int",
 "last_job": {
  "id": "int",
  "started_at": "str",
  "finished_at": "str",
  "user_id": "int",
  "project_id": "int",
  "status": "int",
  "autolaunch_type": "int",
  "all_tasks_issued_at": "str",
  "country": "str",
  "project_separate_balance_enabled": "bool",
  "device": "int"
 },
 "autolaunch_settings": {
  "project_id": "int",
  "active": "bool",
  "pos_check_freq_mins": "int",
  "click_freq_mins": "int",
  "target_pos": "int",
  "budget": "int",
  "error": "str",
  "provider": "str",
  "start_pos": "int",
  "type": "int",
  "device": "int",
  "adaptive_max_target_count": "int",
  "use_recommendations": "bool",
  "click_target_pos": "bool",
  "updated_at": "str",
  "adaptive_start_target_count": "int",
  "adaptive_start_check_freq_mins": "int",
  "use_brand_click": "bool",
  "brand": "str",
  "user_id": "int",
  "adaptive_min_check_freq_mins": "int",
  "allow_demo_yaxml": "bool",
  "adaptive_click_target_pos": "bool",
  "speed_up_adaptive_start": "bool",
  "brand_start_pos": "int",
  "brand_finish_pos": "int",
  "positions_device": "int"
 },
 "project_tops": {
  "project_id": "int",
  "updated_at": "str",
  "top_1": "int",
  "top_3": "int",
  "top_5": "int",
  "top_10": "int",
  "top_20": "int",
  "top_30": "int",
  "top_100": "int",
  "beyond_top_100": "int",
  "delta_top_1": "int",
  "delta_top_3": "int",
  "delta_top_5": "int",
  "delta_top_10": "int",
  "delta_top_20": "int",
  "delta_top_30": "int",
  "delta_top_100": "int",
  "delta_beyond_top_100": "int",
  "avg_position": "float",
  "first_avg_position": "int",
  "delta_avg_position": "int",
  "keywords_count": "int"
 },
 "last_positions_error": "str"
}
```

## project_544055_autolaunch.json
```json
{
 "error": "str",
 "error_raw": "str",
 "result": {
  "project_id": "int",
  "active": "bool",
  "pos_check_freq_mins": "int",
  "click_freq_mins": "int",
  "target_pos": "int",
  "budget": "int",
  "error": "str",
  "provider": "str",
  "start_pos": "int",
  "type": "int",
  "device": "int",
  "adaptive_max_target_count": "int",
  "use_recommendations": "bool",
  "click_target_pos": "bool",
  "updated_at": "str",
  "adaptive_start_target_count": "int",
  "adaptive_start_check_freq_mins": "int",
  "use_brand_click": "bool",
  "brand": "str",
  "user_id": "int",
  "adaptive_min_check_freq_mins": "int",
  "allow_demo_yaxml": "bool",
  "adaptive_click_target_pos": "bool",
  "speed_up_adaptive_start": "bool",
  "brand_start_pos": "int",
  "brand_finish_pos": "int",
  "positions_device": "int"
 },
 "total": "int"
}
```

## project_544055_categories_stat.json
```json
{
 "error": "str",
 "error_raw": "str",
 "result": [
  {
   "id": "int",
   "name": "str",
   "count": "int"
  }
 ],
 "total": "int"
}
```

## project_544055_keywords_v2.json
```json
{
 "total": "int",
 "result": [
  {
   "id": "int",
   "user_id": "int",
   "project_id": "int",
   "created_at": "str",
   "updated_at": "str",
   "text": "str",
   "enabled": "bool",
   "target_count": "int",
   "month_count": "int",
   "adaptive_interval_mins": "int",
   "adaptive_checked_at": "NoneType",
   "adaptive_interval_set": "bool",
   "target_pos": "NoneType",
   "external_id": "NoneType",
   "optimised_at": "NoneType",
   "start_pos": "NoneType",
   "url": "str",
   "adaptive_target_pos_set_at": "NoneType",
   "adaptive_target_pos_changed_delta": "NoneType",
   "adaptive_target_pos": "NoneType",
   "simple_interval_mins": "NoneType",
   "max_target_count": "NoneType",
   "min_adaptive_interval_mins": "NoneType",
   "adaptive_start_pos": "int",
   "external_budget_rub": "NoneType",
   "gather_positions_while_disabled": "bool",
   "adaptive_started_at": "NoneType",
   "use_url": "bool",
   "category": "int",
   "category_updated_at": "str",
   "category_main_campaign_forced_from": "NoneType",
   "frequency": "int",
   "frequency_updated_at": "str",
   "test_completed_at": "str",
   "last_completed_at": "NoneType",
   "frequency_strict": "int",
   "frequency_strict_updated_at": "str",
   "cpc": "NoneType",
   "cpc_updated_at": "NoneType",
   "monthly_price_kopecks": "NoneType"
  }
 ]
}
```

## project_544055_positions_job.json
```json
{
 "error": "str",
 "error_raw": "str",
 "result": {
  "id": "int",
  "started_at": "str",
  "user_id": "int",
  "project_id": "int",
  "status": "int",
  "error": "str",
  "provider": "str",
  "manual_launch": "bool",
  "raw_error": "str",
  "device": "int"
 },
 "total": "int"
}
```

## projects_list.json
```json
{
 "projects": [
  {
   "id": "int",
   "item_id": "int",
   "name": "str",
   "domain": "str",
   "parent_id": "int"
  }
 ]
}
```

## referals.json
```json
{
 "status": "int",
 "body": "str"
}
```

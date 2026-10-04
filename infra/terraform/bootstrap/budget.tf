# The budget alert as code. Credits are excluded so alerts reflect real usage while the
# free-trial credit is paying.
locals {
  budget_thresholds = [
    { percent = 0.25, basis = "CURRENT_SPEND" },
    { percent = 0.50, basis = "FORECASTED_SPEND" },
    { percent = 0.90, basis = "FORECASTED_SPEND" },
    { percent = 1.00, basis = "FORECASTED_SPEND" },
    { percent = 1.00, basis = "CURRENT_SPEND" },
  ]
}

resource "google_billing_budget" "lab" {
  billing_account = var.billing_account_id
  display_name    = "shopverse-lab (terraform)"

  budget_filter {
    projects               = ["projects/${data.google_project.this.number}"]
    calendar_period        = "MONTH"
    credit_types_treatment = "EXCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.budget_amount)
    }
  }

  dynamic "threshold_rules" {
    for_each = local.budget_thresholds
    content {
      threshold_percent = threshold_rules.value.percent
      spend_basis       = threshold_rules.value.basis
    }
  }

  # No all_updates_rule: alerts then go to the billing account's admins by email (default).

  depends_on = [google_project_service.apis]
}

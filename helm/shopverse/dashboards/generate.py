# Generates shopverse-overview.json. Edit this, then run: python3 helm/shopverse/dashboards/generate.py helm/shopverse/dashboards/shopverse-overview.json
import json, sys
DS = {"type": "prometheus", "uid": "${datasource}"}
LOKI = {"type": "loki", "uid": "${loki}"}
PYRO = {"type": "grafana-pyroscope-datasource", "uid": "${pyroscope}"}
SEL = 'namespace=~"$namespace",service=~"$service"'
panels, pid, y = [], [1], [0]

def nid():
    pid[0] += 1
    return pid[0]

def row(title):
    panels.append({"type": "row", "title": title, "id": nid(), "collapsed": False,
                   "gridPos": {"h": 1, "w": 24, "x": 0, "y": y[0]}, "panels": []})
    y[0] += 1

def place(items, h):
    x = 0
    for p, w in items:
        p["gridPos"] = {"h": h, "w": w, "x": x, "y": y[0]}
        p["id"] = nid()
        panels.append(p)
        x += w
    y[0] += h

def stat(title, expr, unit="short", decimals=None, color="blue"):
    p = {"type": "stat", "title": title, "datasource": DS,
         "targets": [{"refId": "A", "datasource": DS, "expr": expr, "instant": True}],
         "fieldConfig": {"defaults": {"unit": unit, "color": {"mode": "fixed", "fixedColor": color}}, "overrides": []},
         "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                     "colorMode": "background", "graphMode": "none", "textMode": "value"}}
    if decimals is not None:
        p["fieldConfig"]["defaults"]["decimals"] = decimals
    return p

def ts(title, targets, unit="short", stack=False, desc=None, minmax=None):
    p = {"type": "timeseries", "title": title, "datasource": DS,
         "targets": [{"refId": chr(65 + i), "datasource": DS, "expr": e, "legendFormat": l} for i, (e, l) in enumerate(targets)],
         "fieldConfig": {"defaults": {"unit": unit, "custom": {"fillOpacity": 15, "lineWidth": 2, "showPoints": "never",
                                                               "stacking": {"mode": "normal" if stack else "none"}}},
                         "overrides": []},
         "options": {"legend": {"displayMode": "table", "placement": "right", "calcs": ["mean", "max"]},
                     "tooltip": {"mode": "multi", "sort": "desc"}}}
    if desc:
        p["description"] = desc
    if minmax:
        p["fieldConfig"]["defaults"]["min"], p["fieldConfig"]["defaults"]["max"] = minmax
    return p

row("Business")
place([
    (stat("Orders (24h)", 'sum(increase(shopverse_orders_placed_total{namespace=~"$namespace"}[24h]))', decimals=0), 4),
    (stat("Revenue (24h)", 'sum(increase(shopverse_revenue_inr_total{namespace=~"$namespace"}[24h]))', "currencyINR", 0, "green"), 5),
    (stat("Avg order value (1h)", 'sum(rate(shopverse_order_value_inr_sum{namespace=~"$namespace"}[1h])) / sum(rate(shopverse_order_value_inr_count{namespace=~"$namespace"}[1h]))', "currencyINR", 0, "purple"), 5),
    (stat("New users (24h)", 'sum(increase(shopverse_users_registered_total{namespace=~"$namespace"}[24h]))', decimals=0, color="orange"), 5),
    (stat("Payment decline rate (1h)", 'sum(rate(shopverse_payments_total{namespace=~"$namespace",status="FAILED"}[1h])) / sum(rate(shopverse_payments_total{namespace=~"$namespace"}[1h]))', "percentunit", 1, "red"), 5),
], 4)
place([
    (ts("Orders per minute by payment method", [('sum by (payment_method) (rate(shopverse_orders_placed_total{namespace=~"$namespace"}[5m])) * 60', "{{payment_method}}")], stack=True), 8),
    (ts("Payments by status", [('sum by (status) (rate(shopverse_payments_total{namespace=~"$namespace"}[5m])) * 60', "{{status}}")], stack=True), 8),
    (ts("Checkout failures by reason", [('sum by (reason) (rate(shopverse_checkout_failures_total{namespace=~"$namespace"}[5m])) * 60', "{{reason}}")]), 8),
], 8)

row("Traffic (RED)")
place([
    (ts("Request rate", [(f'sum by (service) (rate(http_request_duration_seconds_count{{{SEL}}}[$__rate_interval]))', "{{service}}")], "reqps"), 8),
    (ts("Error ratio (5xx)", [(f'sum by (service) (rate(http_request_duration_seconds_count{{{SEL},status_code=~"5.."}}[$__rate_interval])) / sum by (service) (rate(http_request_duration_seconds_count{{{SEL}}}[$__rate_interval]))', "{{service}}")], "percentunit", minmax=(0, 1)), 8),
    (ts("Latency p95", [(f'histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket{{{SEL}}}[$__rate_interval])))', "{{service}}")], "s"), 8),
], 8)
slow = {"type": "table", "title": "Slowest routes (p95, 15m)", "datasource": DS,
        "targets": [{"refId": "A", "datasource": DS, "format": "table", "instant": True,
                     "expr": f'topk(10, histogram_quantile(0.95, sum by (service, method, route, le) (rate(http_request_duration_seconds_bucket{{{SEL},route!="unmatched"}}[15m]))))'}],
        "fieldConfig": {"defaults": {"unit": "s"}, "overrides": []},
        "transformations": [{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"Value": "p95"}}}],
        "options": {"sortBy": [{"displayName": "p95", "desc": True}]}}
place([
    (slow, 12),
    (ts("Requests by status code", [(f'sum by (status_code) (rate(http_request_duration_seconds_count{{{SEL}}}[$__rate_interval]))', "{{status_code}}")], "reqps", stack=True), 12),
], 8)

row("Node.js runtime")
place([
    (ts("CPU (cores)", [(f'sum by (service) (rate(process_cpu_seconds_total{{{SEL}}}[$__rate_interval]))', "{{service}}")]), 6),
    (ts("Heap used", [(f'sum by (service) (nodejs_heap_size_used_bytes{{{SEL}}})', "{{service}}")], "bytes"), 6),
    (ts("Event loop lag p99", [(f'max by (service) (nodejs_eventloop_lag_p99_seconds{{{SEL}}})', "{{service}}")], "s"), 6),
    (ts("MongoDB connected", [(f'min by (service) (mongodb_connection_up{{{SEL}}})', "{{service}}")]), 6),
], 7)

row("Logs (Loki)")
logs = {"type": "logs", "title": "Warnings & errors", "datasource": LOKI,
        "targets": [{"refId": "A", "datasource": LOKI,
                     "expr": '{namespace=~"$namespace", app=~"$service", level=~"warn|error"} | json | __error__=""'}],
        "options": {"showTime": True, "wrapLogMessage": True, "prettifyLogMessage": False, "enableLogDetails": True,
                    "sortOrder": "Descending", "dedupStrategy": "none"}}
lograte = ts("Log lines by level", [], "short", stack=True)
lograte["datasource"] = LOKI
lograte["targets"] = [{"refId": "A", "datasource": LOKI,
                       "expr": 'sum by (app, level) (count_over_time({namespace=~"$namespace", app=~"$service"} [$__auto]))',
                       "legendFormat": "{{app}} {{level}}"}]
place([(lograte, 8), (logs, 16)], 10)

row("Profiling (Pyroscope)")
flame = {"type": "flamegraph", "title": "CPU / wall-time flame graph: $profile_service", "datasource": PYRO,
         "description": "Continuous profile pushed by the @pyroscope/nodejs SDK. Pick a service in the 'Profiled service' variable.",
         "targets": [{"refId": "A", "datasource": PYRO, "queryType": "profile",
                      "profileTypeId": "wall:wall:nanoseconds:wall:nanoseconds",
                      "labelSelector": '{service_name="$profile_service"}', "groupBy": []}]}
place([(flame, 24)], 14)

def var_ds(name, label, typ, regex=""):
    return {"name": name, "label": label, "type": "datasource", "query": typ, "regex": regex,
            "hide": 0, "current": {}, "refresh": 1, "includeAll": False, "multi": False, "options": []}

dashboard = {
    "uid": "shopverse-overview",
    "title": "ShopVerse / Overview",
    "description": "Business KPIs, RED metrics, runtime, logs and profiles for ShopVerse microservices",
    "tags": ["shopverse", "microservices"],
    "timezone": "browser",
    "schemaVersion": 39,
    "version": 1,
    "editable": True,
    "graphTooltip": 1,
    "refresh": "30s",
    "time": {"from": "now-3h", "to": "now"},
    "links": [{"title": "Explore logs", "type": "link", "icon": "doc", "url": "/explore", "targetBlank": True}],
    "templating": {"list": [
        var_ds("datasource", "Prometheus", "prometheus"),
        var_ds("loki", "Loki", "loki"),
        var_ds("pyroscope", "Pyroscope", "grafana-pyroscope-datasource"),
        {"name": "namespace", "label": "Namespace", "type": "query", "datasource": DS,
         "query": {"query": "label_values(http_request_duration_seconds_count, namespace)", "refId": "ns"},
         "definition": "label_values(http_request_duration_seconds_count, namespace)",
         "refresh": 2, "includeAll": True, "multi": True, "allValue": ".+", "current": {}, "hide": 0, "sort": 1},
        {"name": "service", "label": "Service", "type": "query", "datasource": DS,
         "query": {"query": 'label_values(http_request_duration_seconds_count{namespace=~"$namespace"}, service)', "refId": "svc"},
         "definition": 'label_values(http_request_duration_seconds_count{namespace=~"$namespace"}, service)',
         "refresh": 2, "includeAll": True, "multi": True,
         "allValue": "api-gateway|user-service|product-service|cart-service|order-service|payment-service", "current": {}, "hide": 0, "sort": 1},
        {"name": "profile_service", "label": "Profiled service", "type": "custom",
         "query": ",".join(f"shopverse.{s}" for s in ["api-gateway", "user-service", "product-service", "cart-service", "order-service", "payment-service"]),
         "current": {"text": "shopverse.order-service", "value": "shopverse.order-service"},
         "hide": 0, "includeAll": False, "multi": False, "options": []},
    ]},
    "annotations": {"list": [{"builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"}, "enable": True,
                              "hide": True, "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts", "type": "dashboard"}]},
    "panels": panels,
}
json.dump(dashboard, open(sys.argv[1], "w"), indent=2)
print(len(panels), "panels")

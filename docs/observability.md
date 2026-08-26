# Observability Guide

This document describes the logging and metrics infrastructure for the three-tier application.

## Table of Contents

- [Overview](#overview)
- [Logging](#logging)
- [Metrics](#metrics)
- [Tracing](#tracing)
- [Alerting](#alerting)
- [Dashboards](#dashboards)

## Overview

The three-tier application implements comprehensive observability across all layers:
- **Presentation Tier**: Frontend application logging and user interaction metrics
- **Application Tier**: API server logs, business logic metrics, and performance data
- **Data Tier**: Database query logs, connection pool metrics, and storage statistics

## Logging

### Log Levels

We use the following log levels across all tiers:

- **ERROR**: Critical issues requiring immediate attention
- **WARN**: Warning conditions that should be reviewed
- **INFO**: General informational messages about application flow
- **DEBUG**: Detailed debugging information (disabled in production)

### Log Format

All logs follow a structured JSON format for easy parsing and analysis:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "service": "api-server",
  "tier": "application",
  "message": "Request processed successfully",
  "requestId": "req-abc123",
  "userId": "user-456",
  "duration": 145,
  "metadata": {
    "endpoint": "/api/users",
    "method": "GET",
    "statusCode": 200
  }
}
```

### Presentation Tier Logging

**Frontend Application**:
- User interactions and navigation events
- JavaScript errors and exceptions
- Performance metrics (page load times, render times)
- API call failures and network errors

**Log Destinations**:
- Browser console (development)
- Centralized logging service (production)
- Error tracking service (e.g., Sentry)

**Example**:
```javascript
logger.info('User action', {
  action: 'button_click',
  component: 'UserProfile',
  userId: currentUser.id
});
```

### Application Tier Logging

**API Server**:
- HTTP request/response logs
- Authentication and authorization events
- Business logic execution
- External service calls
- Error handling and exceptions

**Log Destinations**:
- stdout/stderr (captured by container runtime)
- Centralized logging aggregator (e.g., ELK Stack, Splunk)
- Application Performance Monitoring (APM) tools

**Example**:
```javascript
logger.info('Processing order', {
  orderId: order.id,
  userId: user.id,
  amount: order.total,
  items: order.items.length
});
```

### Data Tier Logging

**Database**:
- Slow query logs (queries exceeding threshold)
- Connection events
- Replication status
- Backup and restore operations
- Schema changes

**Log Destinations**:
- Database server logs
- Centralized logging system
- Database monitoring tools

**Configuration**:
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- Log queries taking > 2 seconds
```

### Log Aggregation

All logs are aggregated in a centralized logging system:

1. **Collection**: Logs are collected from all services using log shippers (e.g., Fluentd, Filebeat)
2. **Processing**: Logs are parsed, enriched, and normalized
3. **Storage**: Logs are stored in a searchable index (e.g., Elasticsearch)
4. **Visualization**: Logs are visualized using dashboards (e.g., Kibana, Grafana)

### Log Retention

- **Production**: 90 days
- **Staging**: 30 days
- **Development**: 7 days

Critical logs (errors, security events) are archived for 1 year.

## Metrics

### Metric Types

We collect four types of metrics:

1. **Counters**: Monotonically increasing values (e.g., total requests)
2. **Gauges**: Point-in-time values (e.g., active connections)
3. **Histograms**: Distribution of values (e.g., request duration)
4. **Summaries**: Statistical summaries (e.g., percentiles)

### Presentation Tier Metrics

**Frontend Metrics**:
- Page load time (p50, p95, p99)
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)
- JavaScript error rate
- API call success/failure rate
- User session duration

**Collection Method**:
- Browser Performance API
- Real User Monitoring (RUM) tools
- Custom instrumentation

### Application Tier Metrics

**API Server Metrics**:
- Request rate (requests per second)
- Request duration (p50, p95, p99)
- Error rate (4xx, 5xx responses)
- Active connections
- CPU usage
- Memory usage
- Garbage collection metrics
- Thread pool utilization

**Business Metrics**:
- User registrations
- Login attempts (success/failure)
- Order processing rate
- Payment success rate
- Feature usage statistics

**Example Prometheus Metrics**:
```
# Request counter
http_requests_total{method="GET",endpoint="/api/users",status="200"} 1523

# Request duration histogram
http_request_duration_seconds_bucket{le="0.1"} 850
http_request_duration_seconds_bucket{le="0.5"} 1200
http_request_duration_seconds_bucket{le="1.0"} 1450

# Active connections gauge
http_active_connections 42
```

### Data Tier Metrics

**Database Metrics**:
- Query execution time (p50, p95, p99)
- Queries per second (QPS)
- Connection pool utilization
- Cache hit ratio
- Replication lag
- Disk I/O operations
- Table sizes
- Index usage statistics
- Lock wait time
- Transaction rate

**Example Queries**:
```sql
-- Monitor slow queries
SELECT query, exec_time, rows_examined 
FROM performance_schema.events_statements_summary_by_digest 
WHERE exec_time > 1000000 
ORDER BY exec_time DESC LIMIT 10;
```

### Metrics Collection

**Infrastructure**:
- **Prometheus**: Time-series database for metrics storage
- **Grafana**: Visualization and dashboards
- **Exporters**: Service-specific metric exporters
  - Node Exporter (system metrics)
  - Database Exporter (database metrics)
  - Custom application exporters

**Scrape Configuration**:
```yaml
scrape_configs:
  - job_name: 'api-server'
    scrape_interval: 15s
    static_configs:
      - targets: ['api-server:9090']
  
  - job_name: 'database'
    scrape_interval: 30s
    static_configs:
      - targets: ['db-exporter:9104']
```

### Metrics Retention

- **High-resolution** (15s interval): 15 days
- **Medium-resolution** (1m interval): 90 days
- **Low-resolution** (5m interval): 1 year

## Tracing

Distributed tracing helps track requests across all tiers:

### Trace Context

Each request is assigned a unique trace ID that propagates through all services:

```
Trace ID: 4bf92f3577b34da6a3ce929d0e0e4736
├─ Span: frontend-request (100ms)
├─ Span: api-gateway (80ms)
│  ├─ Span: auth-service (20ms)
│  └─ Span: user-service (50ms)
│     └─ Span: database-query (30ms)
```

### Implementation

- **OpenTelemetry**: Standard instrumentation library
- **Jaeger/Zipkin**: Trace collection and visualization
- **Context Propagation**: W3C Trace Context headers

### Trace Sampling

- **Production**: 10% sampling rate
- **Staging**: 50% sampling rate
- **Development**: 100% sampling rate

High-priority requests (errors, slow requests) are always sampled.

## Alerting

### Alert Severity Levels

- **P1 (Critical)**: Service down, immediate response required
- **P2 (High)**: Degraded performance, response within 1 hour
- **P3 (Medium)**: Non-critical issues, response within 4 hours
- **P4 (Low)**: Informational, review during business hours

### Key Alerts

**Availability Alerts**:
- Service is down (P1)
- Health check failures (P1)
- High error rate (>5% for 5 minutes) (P2)

**Performance Alerts**:
- High response time (p95 > 2s for 10 minutes) (P2)
- Database connection pool exhausted (P1)
- High CPU usage (>80% for 15 minutes) (P3)
- High memory usage (>85% for 15 minutes) (P3)

**Business Alerts**:
- Payment processing failures (>1% for 5 minutes) (P1)
- User registration failures (>5% for 10 minutes) (P2)
- Unusual traffic patterns (P3)

### Alert Channels

- **P1/P2**: PagerDuty, Slack, Email
- **P3/P4**: Slack, Email

## Dashboards

### System Overview Dashboard

- Overall system health status
- Request rate across all services
- Error rate trends
- Response time percentiles
- Resource utilization (CPU, memory, disk)

### Service-Specific Dashboards

**Frontend Dashboard**:
- Page load metrics
- User sessions
- JavaScript errors
- API call performance

**API Server Dashboard**:
- Request throughput
- Endpoint performance
- Error rates by endpoint
- Authentication metrics

**Database Dashboard**:
- Query performance
- Connection pool status
- Replication lag
- Cache hit ratio
- Disk usage

### Business Metrics Dashboard

- Active users
- Transaction volume
- Revenue metrics
- Feature adoption rates
- User engagement metrics

## Best Practices

1. **Use Structured Logging**: Always log in JSON format with consistent fields
2. **Include Context**: Add request IDs, user IDs, and correlation IDs to all logs
3. **Log at Appropriate Levels**: Don't over-log; use DEBUG sparingly
4. **Sanitize Sensitive Data**: Never log passwords, tokens, or PII
5. **Monitor What Matters**: Focus on metrics that indicate user impact
6. **Set Meaningful Alerts**: Avoid alert fatigue with well-tuned thresholds
7. **Document Runbooks**: Link alerts to runbooks for faster resolution
8. **Regular Review**: Periodically review and update observability configuration

## Tools and Services

- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) or Splunk
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger or Zipkin
- **APM**: New Relic, Datadog, or Dynatrace
- **Error Tracking**: Sentry or Rollbar
- **Alerting**: PagerDuty, Opsgenie
- **Uptime Monitoring**: Pingdom, UptimeRobot

## Related Documentation

- [Runbook](./runbook.md) - Incident response procedures
- [Architecture](./architecture.md) - System architecture overview
- [Deployment](./deployment.md) - Deployment procedures

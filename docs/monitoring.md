# Monitoring Guide

This document describes the monitoring setup for the three-tier application, including dashboards, alerts, and key metrics to track.

## Overview

The application monitoring stack tracks the health and performance of all three tiers:
- **Frontend (Next.js)**: User-facing web application
- **API (Express)**: Backend REST API
- **Database (PostgreSQL)**: Data persistence layer

## Dashboards

### Application Overview Dashboard

The main dashboard provides a high-level view of system health across all tiers.

**Key Metrics:**
- Request rate (requests per second)
- Error rate (percentage of failed requests)
- Response time (p50, p95, p99 latencies)
- Service availability (uptime percentage)

**Panels:**
1. **Traffic Overview**: Total requests across web and API services
2. **Error Rates**: HTTP 4xx and 5xx errors by service
3. **Latency Distribution**: Response time percentiles over time
4. **Service Health**: Current status of all services (web, api, database)

### Frontend Dashboard

Monitors the Next.js web application performance and user experience.

**Key Metrics:**
- Page load times
- Client-side errors
- Core Web Vitals (LCP, FID, CLS)
- Active user sessions
- Browser compatibility issues

**Panels:**
1. **Page Performance**: Load times by route
2. **JavaScript Errors**: Client-side error tracking
3. **User Experience**: Core Web Vitals scores
4. **Traffic Sources**: Geographic distribution and referrers

### API Dashboard

Tracks the Express API backend performance and reliability.

**Key Metrics:**
- Request throughput by endpoint
- Response times by endpoint
- Error rates by status code
- Database query performance
- Connection pool utilization

**Panels:**
1. **Endpoint Performance**: Latency and throughput per route
2. **Error Analysis**: Breakdown of 4xx and 5xx errors
3. **Database Queries**: Query execution times and counts
4. **Resource Usage**: CPU, memory, and connection pool stats

### Database Dashboard

Monitors PostgreSQL database health and performance.

**Key Metrics:**
- Query execution time
- Connection count
- Cache hit ratio
- Disk I/O
- Replication lag (if applicable)
- Table and index sizes

**Panels:**
1. **Query Performance**: Slowest queries and execution times
2. **Connections**: Active, idle, and waiting connections
3. **Cache Efficiency**: Buffer cache hit ratio
4. **Storage**: Database size, table growth, and disk usage
5. **Locks**: Lock contention and wait events

### Infrastructure Dashboard

Monitors the underlying infrastructure (GCP Cloud Run and Cloud SQL).

**Key Metrics:**
- Container instance count
- CPU and memory utilization
- Network throughput
- Cold start frequency
- Billing and cost metrics

**Panels:**
1. **Container Scaling**: Instance count over time
2. **Resource Utilization**: CPU and memory by service
3. **Network**: Ingress/egress bandwidth
4. **Cost Analysis**: Estimated costs by service

## Alerts

### Critical Alerts (Page immediately)

These alerts indicate severe issues requiring immediate attention:

#### High Error Rate
- **Condition**: Error rate > 5% for 5 minutes
- **Severity**: Critical
- **Action**: Check service logs, recent deployments, and database connectivity

#### Service Down
- **Condition**: Health check fails for 2 consecutive minutes
- **Severity**: Critical
- **Action**: Verify service status, check container logs, restart if necessary

#### Database Connection Failure
- **Condition**: Database connection pool exhausted or connection failures > 10%
- **Severity**: Critical
- **Action**: Check database status, connection limits, and network connectivity

#### High Latency
- **Condition**: p95 response time > 5 seconds for 10 minutes
- **Severity**: Critical
- **Action**: Investigate slow queries, check resource utilization, review recent changes

### Warning Alerts (Notify but don't page)

These alerts indicate potential issues that should be investigated:

#### Elevated Error Rate
- **Condition**: Error rate > 2% for 15 minutes
- **Severity**: Warning
- **Action**: Monitor trends, review error logs, prepare for escalation

#### Increased Latency
- **Condition**: p95 response time > 2 seconds for 15 minutes
- **Severity**: Warning
- **Action**: Check database query performance, review API endpoint efficiency

#### High Resource Utilization
- **Condition**: CPU > 80% or Memory > 85% for 20 minutes
- **Severity**: Warning
- **Action**: Consider scaling up, investigate resource leaks

#### Database Cache Hit Ratio Low
- **Condition**: Cache hit ratio < 90% for 30 minutes
- **Severity**: Warning
- **Action**: Review query patterns, consider increasing cache size

#### Connection Pool Near Limit
- **Condition**: Active connections > 80% of pool size for 15 minutes
- **Severity**: Warning
- **Action**: Review connection usage, consider increasing pool size

### Informational Alerts

These alerts provide awareness of system changes:

#### Deployment Detected
- **Condition**: New container version deployed
- **Severity**: Info
- **Action**: Monitor error rates and latency for regressions

#### Unusual Traffic Pattern
- **Condition**: Request rate deviates > 50% from baseline
- **Severity**: Info
- **Action**: Verify if expected (e.g., marketing campaign, bot traffic)

#### Database Backup Completed
- **Condition**: Scheduled backup finishes
- **Severity**: Info
- **Action**: Verify backup success in logs

## Metrics Collection

### Application Instrumentation

The application uses the following instrumentation:

- **Frontend**: Browser performance API, custom event tracking
- **API**: Express middleware for request/response metrics
- **Database**: PostgreSQL statistics views and slow query log

### Monitoring Stack

- **Metrics Storage**: Prometheus or Google Cloud Monitoring
- **Visualization**: Grafana or Google Cloud Console
- **Alerting**: Alertmanager or Google Cloud Alerting
- **Log Aggregation**: Cloud Logging or ELK stack

### Key Metrics to Track

#### Golden Signals (SRE)

1. **Latency**: Time to service requests
2. **Traffic**: Demand on the system
3. **Errors**: Rate of failed requests
4. **Saturation**: Resource utilization

#### RED Method (for services)

1. **Rate**: Requests per second
2. **Errors**: Failed requests per second
3. **Duration**: Request latency distribution

#### USE Method (for resources)

1. **Utilization**: Percentage of time resource is busy
2. **Saturation**: Queue depth or wait time
3. **Errors**: Error count

## Runbooks

For each alert, detailed runbooks are available:

- [High Error Rate Runbook](./runbooks/high-error-rate.md)
- [Service Down Runbook](./runbooks/service-down.md)
- [Database Issues Runbook](./runbooks/database-issues.md)
- [Performance Degradation Runbook](./runbooks/performance-degradation.md)

## Dashboard Access

### Local Development
- Grafana: http://localhost:3001/grafana (if configured)
- Prometheus: http://localhost:9090 (if configured)

### Production
- Google Cloud Console: https://console.cloud.google.com/monitoring
- Custom Grafana: [Contact DevOps for access]

## Best Practices

1. **Review dashboards regularly**: Check key metrics daily during business hours
2. **Tune alert thresholds**: Adjust based on baseline performance and false positive rate
3. **Document incidents**: Record root causes and resolutions for future reference
4. **Test alerts**: Regularly verify alert delivery and escalation paths
5. **Keep runbooks updated**: Update procedures as the system evolves
6. **Monitor the monitors**: Ensure monitoring infrastructure itself is healthy

## Related Documentation

- [On-Call Rotation Guide](./oncall.md)
- [Incident Response Procedures](./incident-response.md)
- [Deployment Guide](../README.md#deploying-to-gcp)

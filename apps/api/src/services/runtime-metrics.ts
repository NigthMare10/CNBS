interface RouteMetric {
  route: string;
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastDurationMs: number;
  totalPayloadBytes: number;
  maxPayloadBytes: number;
  lastPayloadBytes: number;
  lastStatusCode: number;
  lastSeenAt: string | null;
}

function initialMetric(route: string): RouteMetric {
  return {
    route,
    count: 0,
    errorCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastDurationMs: 0,
    totalPayloadBytes: 0,
    maxPayloadBytes: 0,
    lastPayloadBytes: 0,
    lastStatusCode: 0,
    lastSeenAt: null
  };
}

class RuntimeMetricsCollector {
  private readonly routes = new Map<string, RouteMetric>();

  record(input: { route: string; statusCode: number; durationMs: number; payloadBytes: number }) {
    const metric = this.routes.get(input.route) ?? initialMetric(input.route);
    metric.count += 1;
    metric.errorCount += input.statusCode >= 400 ? 1 : 0;
    metric.totalDurationMs += input.durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, input.durationMs);
    metric.lastDurationMs = input.durationMs;
    metric.totalPayloadBytes += input.payloadBytes;
    metric.maxPayloadBytes = Math.max(metric.maxPayloadBytes, input.payloadBytes);
    metric.lastPayloadBytes = input.payloadBytes;
    metric.lastStatusCode = input.statusCode;
    metric.lastSeenAt = new Date().toISOString();
    this.routes.set(input.route, metric);
  }

  snapshot() {
    return Array.from(this.routes.values())
      .map((metric) => ({
        route: metric.route,
        count: metric.count,
        errorCount: metric.errorCount,
        averageDurationMs: metric.count === 0 ? 0 : Number((metric.totalDurationMs / metric.count).toFixed(2)),
        maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
        lastDurationMs: Number(metric.lastDurationMs.toFixed(2)),
        averagePayloadBytes: metric.count === 0 ? 0 : Math.round(metric.totalPayloadBytes / metric.count),
        maxPayloadBytes: metric.maxPayloadBytes,
        lastPayloadBytes: metric.lastPayloadBytes,
        lastStatusCode: metric.lastStatusCode,
        lastSeenAt: metric.lastSeenAt
      }))
      .sort((left, right) => left.route.localeCompare(right.route));
  }
}

export const runtimeMetrics = new RuntimeMetricsCollector();

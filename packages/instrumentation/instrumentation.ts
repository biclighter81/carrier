import packageJson from './package.json';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { metrics } from '@opentelemetry/api';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import * as logsAPI from '@opentelemetry/api-logs';
import * as winston from 'winston';
import {
  SimpleLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: packageJson.version,
    ['service.group']: process.env.SERVICE_GROUP,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_COLLECTOR_URL + '/v1/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_COLLECTOR_URL + '/v1/metrics',
    }),
  }),
  logRecordProcessors: [
    new SimpleLogRecordProcessor(
      new OTLPLogExporter({
        url: process.env.OTEL_COLLECTOR_URL + '/v1/logs',
      })
    ),
  ],
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Create and register logger provider
const loggerProvider = new LoggerProvider();
loggerProvider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(
    new OTLPLogExporter({
      url: process.env.OTEL_COLLECTOR_URL + '/v1/logs',
    })
  )
);
logsAPI.logs.setGlobalLoggerProvider(loggerProvider);
registerInstrumentations({
  instrumentations: [new WinstonInstrumentation()],
});
const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});
logger.info(
  'Logger initialized. Sending telemetry to ' + process.env.OTEL_COLLECTOR_URL
);
// Create meter
const meter = metrics.getMeter(process.env.SERVICE_NAME || 'unknown-service');

export { logger, metrics, meter, sdk };

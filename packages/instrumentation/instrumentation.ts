import packageJson from './package.json';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { metrics } from '@opentelemetry/api';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  SimpleLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import * as winston from 'winston';
import { logs } from '@opentelemetry/api-logs';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BullMQInstrumentation } from '@appsignal/opentelemetry-instrumentation-bullmq';
import { BullMQOtel } from 'bullmq-otel';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
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
  instrumentations: [
    getNodeAutoInstrumentations(),
    new BullMQInstrumentation(),
  ],
});

sdk.start();
// To start a logger, you first need to initialize the Logger provider.
const loggerProvider = new LoggerProvider();
logs.setGlobalLoggerProvider(loggerProvider);
const logger = winston.createLogger({
  level: 'info',
  transports: [
    new OpenTelemetryTransportV3(),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});
logger.info(
  'Logger initialized. Sending telemetry to ' + process.env.OTEL_COLLECTOR_URL
);
// Create meter
const meter = metrics.getMeter(process.env.SERVICE_NAME || 'unknown-service');

// Create Feature Flag Provider
OpenFeature.setProvider(
  new FlagdProvider(
    {
      host: process.env.FLAGD_HOST || 'localhost',
      cache: 'disabled',
    },
    logger
  )
);
const flagClient = OpenFeature.getClient();

export { logger, metrics, meter, sdk, BullMQOtel, flagClient };

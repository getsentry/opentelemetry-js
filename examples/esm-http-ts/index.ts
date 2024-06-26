import * as Sentry from "@sentry/node";
import {
  SentrySpanProcessor,
  SentryPropagator,
  SentrySampler,
} from "@sentry/opentelemetry";

// Make sure `Sentry.init` is called before any other OTEL code
Sentry.init({
  // fake DSN
  dsn: "https://public@dsn.ingest.sentry.io/1337",
  skipOpenTelemetrySetup: true,

  beforeSendTransaction: (transaction) => {
    // Log out transactions for debugging, don't send any data to Sentry
    console.log(transaction);
    return null;
  },

  // The SentrySampler will use this to determine which traces to sample
  tracesSampleRate: 1.0,
});

import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { trace, DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import http from 'http';

// Turn of OTEL debug logging in favour of Sentry debug logging
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sentryClient = Sentry.getClient();

const tracerProvider = new NodeTracerProvider({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'esm-http-ts-example',
  }),
  sampler: sentryClient ? new SentrySampler(sentryClient) : undefined,
});
const exporter = new ConsoleSpanExporter();
const processor = new SimpleSpanProcessor(exporter);
tracerProvider.addSpanProcessor(new SentrySpanProcessor());
tracerProvider.addSpanProcessor(processor);
tracerProvider.register({
  propagator: new SentryPropagator(),
  contextManager: new Sentry.SentryContextManager(),
});

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()],
});

Sentry.validateOpenTelemetrySetup();

const hostname = '0.0.0.0';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  const tracer = trace.getTracer('esm-tracer');
  tracer.startActiveSpan('manual', span => {
    span.end();
  });
  res.end('Hello, World!\n');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

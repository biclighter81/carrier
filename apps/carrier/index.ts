import dotenv from 'dotenv';
dotenv.config();

import {
  BullMQOtel,
  logger,
  meter,
  flagClient,
  ValueType,
} from 'instrumentation';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Shipment } from 'types';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const carrierCode = process.env.CARRIER_CODE!;
const carrierKey = carrierCode.toLowerCase(); // für Flags
logger.info(`Bootstrapping ${carrierCode} worker...`);

const shipmentCounter = meter.createCounter('shipments_processed', {
  description: 'Counts the number of shipments processed',
});

new Worker<Shipment>(
  carrierCode,
  async (job) => {
    logger.info(`Processing ${carrierCode} shipment`, {
      jobId: job.id,
      shipment: job.data,
    });

    // 🔁 Feature Flag Simulationen
    const [simulateDelay, simulateUnavailable, simulatePartialSuccess] =
      await Promise.all([
        flagClient.getBooleanValue(
          `simulate.carrier.${carrierKey}.delay`,
          false
        ),
        flagClient.getBooleanValue(
          `simulate.carrier.${carrierKey}.unavailable`,
          false
        ),
        flagClient.getBooleanValue(
          `simulate.carrier.${carrierKey}.partialSuccess`,
          false
        ),
      ]);

    if (simulateUnavailable) {
      logger.warn(`Simulated ${carrierCode} API unavailability triggered`);
      logger.error(`External ${carrierCode} API not reachable`);
      throw new Error(`Simulated ${carrierCode} API outage`);
    }

    // 📊 Telemetrie
    const externalCarrierResponseTime = meter.createHistogram(
      'external.carrier.response_time',
      {
        description: 'Disribution of external carrier API response times',
        unit: 'ms',
        valueType: ValueType.INT,
      }
    );
    const start = process.hrtime();
    const result = await processShipment(
      job.data,
      simulatePartialSuccess,
      simulateDelay
    );
    const [s, ns] = process.hrtime(start);
    const duration = s + ns / 1e6; // convert to milliseconds
    externalCarrierResponseTime.record(duration, {
      carrierCode,
    });
    logger.info(`${carrierCode} shipment processed`, {
      jobId: job.id,
      shipment: job.data,
      result,
    });

    shipmentCounter.add(1, { carrierCode });

    return result;
  },
  {
    connection: redis,
    concurrency: 5,
    telemetry: new BullMQOtel(process.env.SERVICE_NAME!),
  }
);

logger.info(`📦 ${carrierCode} worker started!`);

class ShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShipmentError';
  }
}

async function processShipment(
  shipment: Shipment,
  simulatePartial: boolean,
  simulateDelay: boolean
) {
  const payload = transformToCarrierFormat(shipment);
  if (simulateDelay) {
    const delayMs = Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000; // 1000–4000ms
    logger.warn(`Simulating processing delay for ${carrierCode}: ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  try {
    const res = await fetch(`${process.env.CARRIER_EXTERNAL_URL}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error('Failed to process shipment', {
        status: res.status,
        statusText: res.statusText,
        response: await res.text(),
      });
      throw new ShipmentError(`Failed to process shipment: ${res.statusText}`);
    }

    const label = await res.json();

    if (simulatePartial) {
      logger.warn(`Simulating partial success for ${carrierCode}`);
      // Fail in 10% of the cases
      if (Math.random() < 0.1) {
        logger.error('Simulated partial success triggered');
        throw new ShipmentError(`Simulated partial fail!`);
      }
    }

    return label;
  } catch (error) {
    if (error instanceof ShipmentError) throw error;

    logger.error(`External ${carrierCode} API not reachable`, { error });
    throw new Error(`Error processing shipment: ${error}`);
  }
}

function transformToCarrierFormat(shipment: Shipment) {
  return {
    shipmentId: shipment.shipmentId,
    recipient: {
      name: shipment.destination.name,
      street: shipment.destination.street1,
      city: shipment.destination.city,
      postalCode: shipment.destination.postalCode,
      country: shipment.destination.country,
    },
    parcels: shipment.parcels.map((p) => ({
      weight: p.weight.value,
      dimensions: p.dimensions,
      contents: p.contentsDescription,
      value: p.value?.amount,
    })),
    service: shipment.carrier.serviceLevel,
    metadata: shipment.metadata,
  };
}

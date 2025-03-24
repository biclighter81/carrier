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
    try {
      logger.info(`Processing ${carrierCode} shipment`, {
        jobId: job.id,
        shipment: job.data,
      });

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
        logger.warn('External carrier will simulate unavailability');
      }
      if (simulateDelay) {
        logger.warn('External carrier will simulate delay');
      }
      if (simulatePartialSuccess) {
        logger.warn('External carrier will simulate partial success');
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
      const result = await processShipment(job.data);
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
    } catch (error) {
      logger.error(`Error processing shipment`, {
        jobId: job.id,
        error,
      });
      throw error;
    }
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

async function processShipment(shipment: Shipment) {
  const payload = transformToCarrierFormat(shipment);
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

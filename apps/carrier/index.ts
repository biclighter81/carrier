import dotenv from 'dotenv';
dotenv.config();
import { BullMQOtel, logger, meter, flagClient } from 'instrumentation';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Shipment } from 'types';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const carrierCode = process.env.CARRIER_CODE!;
logger.info(`Bootstrapping ${carrierCode} worker...`);
setInterval(async () => {
  const flag = await flagClient.getStringValue('dhl-flag', 'default-value');
  logger.info('Feature flag value: ' + flag);
}, 5000);
const shipmentCounter = meter.createCounter('shipments_processed', {
  description: 'Counts the number of shipments processed',
});
const worker = new Worker<Shipment>(
  carrierCode,
  async (job) => {
    logger.info(`Processing ${carrierCode} shipment`, {
      jobId: job.id,
      shipment: job.data,
    });
    const ret = await processShipment(job.data);
    logger.info(`${carrierCode} shipment processed`, {
      jobId: job.id,
      shipment: job.data,
      ret,
    });
    shipmentCounter.add(1, { carrierCode: carrierCode });
    return ret;
  },
  {
    connection: redis,
    concurrency: 5,
    telemetry: new BullMQOtel(process.env.SERVICE_NAME!),
  }
);
logger.info(`📦 ${carrierCode} worker started!`);

class ShippmentError extends Error {
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.error('Failed to process shipment', {
        status: res.status,
        statusText: res.statusText,
        response: await res.text(),
      });
      throw new ShippmentError(`Failed to process shipment: ${res.statusText}`);
    } else {
      const label = await res.json();

      return label;
    }
  } catch (error) {
    if (error instanceof ShippmentError) {
      throw error;
    }
    // Handle network errors or other unexpected errors
    logger.error(`External ${carrierCode} API not reachable`, {
      error,
    });
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

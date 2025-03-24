import dotenv from 'dotenv';
dotenv.config();
import { BullMQOtel, logger, meter, flagClient } from 'instrumentation';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CarrierCode, Shipment } from 'types';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
logger.info('Bootstrapping DHL worker...');
setInterval(async () => {
  const flag = await flagClient.getStringValue('dhl-flag', 'default-value');
  logger.info('Feature flag value:', { flag });
}, 5000);
const shipmentCounter = meter.createCounter('shipments_processed', {
  description: 'Counts the number of shipments processed',
});
const worker = new Worker<Shipment>(
  CarrierCode.DHL,
  async (job) => {
    logger.info('Processing DHL shipment', {
      jobId: job.id,
      shipment: job.data,
    });
    const ret = await processDhlShipment(job.data);
    logger.info('DHL shipment processed', {
      jobId: job.id,
      shipment: job.data,
      ret,
    });
    shipmentCounter.add(1, { carrierCode: CarrierCode.DHL });
    return ret;
  },
  {
    connection: redis,
    concurrency: 5,
    telemetry: new BullMQOtel(process.env.SERVICE_NAME!),
  }
);
logger.info('📦 DHL worker started!');

worker.on('failed', (job, err) => {
  console.error(`[DHL Worker] Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`[DHL Worker] Job ${job.id} completed`);
});

class ShippmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShipmentError';
  }
}

async function processDhlShipment(shipment: Shipment) {
  const dhlPayload = transformToDhlFormat(shipment);
  try {
    const res = await fetch(`${process.env.CARRIER_EXTERNAL_URL}/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dhlPayload),
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
    logger.error('External DHL API not reachable', {
      error,
    });
    throw new Error(`Error processing shipment: ${error}`);
  }
}
function transformToDhlFormat(shipment: Shipment) {
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

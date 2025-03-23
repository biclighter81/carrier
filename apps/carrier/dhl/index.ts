import dotenv from 'dotenv';
dotenv.config();
import { BullMQOtel, logger, meter } from 'instrumentation';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { CarrierCode, Shipment } from 'types';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
logger.info('Bootstrapping DHL worker...');

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

async function processDhlShipment(shipment: Shipment) {
  const dhlPayload = transformToDhlFormat(shipment);
  //TODO: call mock carrier api for now return label
  return {
    zplCode: `
        ^XA
        ^FO50,50^ADN,36,20^FDHello World!^FS
        ^XZ
        `,
    dpi: 300,
    labelFormat: 'ZPL',
    labelType: 'PDF',
    labelSize: '4x6',
  };
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

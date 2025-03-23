//create bullmq queues for carrier queues
import { Queue, Worker } from 'bullmq';
import { Shipment } from 'types';
import { logger } from 'instrumentation';

//build a queue for every entry in the carrier code enum
import { CarrierCode } from 'types';

logger.info('Creating carrier queues...');
const carrierQueues = Object.values(CarrierCode).reduce(
  (acc, cur) => {
    const queue = new Queue<Shipment>(`${cur}`, {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });
    return { ...acc, [cur]: queue };
  },

  {} as Record<CarrierCode, Queue<Shipment>>
);

logger.info('Carrier queues created', {
  queues: Object.keys(carrierQueues),
});

export { carrierQueues };

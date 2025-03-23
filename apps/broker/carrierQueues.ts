//create bullmq queues for carrier queues
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { Shipment } from 'types';
import { logger } from 'instrumentation';

//build a queue for every entry in the carrier code enum
import { CarrierCode } from 'types';

const onCompleted = ({
  jobId,
  returnvalue,
}: {
  jobId: string;
  returnvalue: string;
}) => {
  logger.info('Shipment processed', {
    jobId,
    returnvalue,
  });
};

const onFailed = ({
  jobId,
  failedReason,
}: {
  jobId: string;
  failedReason: string;
}) => {
  logger.error('Shipment processing failed', {
    jobId,
    failedReason,
  });
};

const onStalled = ({ jobId }: { jobId: string }) => {
  logger.warn('Shipment processing stalled', {
    jobId,
  });
};

logger.info('Creating carrier queues...');
const carrierQueues = Object.values(CarrierCode).reduce(
  (acc, cur) => {
    const queue = new Queue<Shipment>(`${cur}`, {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });
    const queueEvents = new QueueEvents(`${cur}`, {
      connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });
    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);
    queueEvents.on('stalled', onStalled);
    return { ...acc, [cur]: queue };
  },

  {} as Record<CarrierCode, Queue<Shipment>>
);

logger.info('Carrier queues created', {
  queues: Object.keys(carrierQueues),
});

export { carrierQueues };

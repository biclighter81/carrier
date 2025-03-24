import dotenv from 'dotenv';
dotenv.config();

import { logger, meter, flagClient } from 'instrumentation';
import express from 'express';
import bodyParser from 'body-parser';
import { Shipment } from 'types';
import { carrierQueues } from './carrierQueues';

logger.info('Bootstrapping broker...');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 📊 Metriken
const shipmentCounter = meter.createCounter('shipment_counter', {
  description: 'Counts the number of shipments received',
});
const shipmentCarrierCounter = meter.createCounter('shipment_carrier_counter', {
  description: 'Counts the number of shipments received for specific carrier',
});
const shipmentDestinationCountryCounter = meter.createCounter(
  'shipment_country_counter',
  {
    description:
      'Counts the number of shipments received for specific destination country',
  }
);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/shipment', async (req, res) => {
  logger.info('Received shipment from WMS', { shipment: req.body });

  const shipment = req.body as Shipment;

  // 🧪 Fehler-Simulation über Feature Flags
  const [isUnavailable, isDelayed] = await Promise.all([
    flagClient.getBooleanValue('simulate.broker.unavailable', false),
    flagClient.getBooleanValue('simulate.broker.delay', false),
  ]);

  if (isUnavailable) {
    logger.warn('Simulated broker unavailability triggered');
    res
      .status(503)
      .json({ message: 'Broker temporarily unavailable (simulated)' });
    return;
  }

  if (isDelayed) {
    const delayMs = Math.floor(Math.random() * (3000 - 500 + 1)) + 500; // 500–3000ms
    logger.warn(`Simulating broker delay: ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // 🔢 Zähler erhöhen
  shipmentCounter.add(1, { status: 'received' });
  shipmentCarrierCounter.add(1, { carrierCode: shipment.carrier.carrierCode });
  shipmentDestinationCountryCounter.add(1, {
    destinationCountry: shipment.destination.country,
  });

  const queue = carrierQueues[shipment.carrier.carrierCode];

  if (!queue) {
    logger.error('Carrier queue not found', {
      carrierCode: shipment.carrier.carrierCode,
    });
    res.status(400).json({ message: 'Carrier queue not found' });
    return;
  }

  try {
    await queue.add('shipment', shipment, {
      attempts: 3,
      delay: 1000,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    logger.info('Shipment added to queue', {
      shipmentId: shipment.shipmentId,
      carrierCode: shipment.carrier.carrierCode,
    });

    res.status(200).json({ message: 'Shipment received successfully' });
  } catch (error) {
    logger.error('Error adding shipment to queue', { error });
    res.status(500).json({ message: 'Error adding shipment to queue' });
  }
});

app.listen(PORT, () => {
  logger.info(`🐙 Broker is running on port ${PORT}`);
});

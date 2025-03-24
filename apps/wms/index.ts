import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { logger, flagClient } from 'instrumentation';
import { generateMockShipment } from './generateShipment';

const app = express();
const PORT = process.env.PORT || 3100;

app.get('/shipment', async (req, res) => {
  const simulateDelay = await flagClient.getBooleanValue(
    'simulate.wms.delay',
    false
  );

  if (simulateDelay) {
    const delayMs = Math.floor(Math.random() * (2500 - 500 + 1)) + 500; // 500–2500ms
    logger.warn(`Simulating WMS shipment delay: ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const shipment = generateMockShipment();
  res.json(shipment);
});

app.post('/shipment/dispatch', async (req, res) => {
  logger.info('Dispatching shipment to carrier tool');
  const shipment = generateMockShipment();

  const [simulateError, simulateUnavailable] = await Promise.all([
    flagClient.getBooleanValue('simulate.wms.dispatchError', false),
    flagClient.getBooleanValue('simulate.wms.unavailable', false),
  ]);

  if (simulateUnavailable) {
    logger.warn('Simulated WMS outage triggered');
    res
      .status(503)
      .json({ message: 'WMS temporarily unavailable (simulated)' });
    return;
  }

  if (simulateError) {
    logger.warn('Simulated dispatch failure triggered');
    res.status(500).json({
      message: 'Simulated failure during shipment dispatch',
      shipment,
    });
    return;
  }

  try {
    const r = await fetch(`${process.env.CARRIER_BROKER_URL}/shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipment),
    });

    if (r.ok) {
      logger.info('Shipment dispatched successfully', shipment);
      res.status(200).json({ message: 'Shipment dispatched successfully' });
    } else {
      const errorText = await r.text();
      logger.error(
        'Failed to dispatch shipment',
        { shipment },
        { errorText },
        { status: r.status }
      );

      res.status(500).json({
        message: 'Failed to dispatch shipment',
        shipment,
        errorText,
        errorCode: r.status,
      });
    }
  } catch (error) {
    logger.error('Broker not reachable', { shipment }, { error });
    res.status(500).json({
      message: 'Broker not reachable',
      shipment,
    });
  }
});

app.listen(PORT, () => {
  logger.info(`🚚 Mock-WMS listening at http://localhost:${PORT}`);
});

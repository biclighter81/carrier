import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { logger } from 'instrumentation';
import { generateMockShipment } from './generateShipment';

const app = express();
const PORT = process.env.PORT || 3100;

app.get('/shipment', (req, res) => {
  const shipment = generateMockShipment();
  res.json(shipment);
});

app.post('/shipment/dispatch', async (req, res) => {
  logger.info('Dispatching shipment to carrier tool');
  // Simulate dispatching shipment to the carrier tool
  const shipment = generateMockShipment();
  try {
    const r = await fetch(`${process.env.CARRIER_BROKER_URL}/shipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
        errorText: errorText,
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

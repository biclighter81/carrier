import dotenv from 'dotenv';
dotenv.config();
import { logger, flagClient } from 'instrumentation';
import express from 'express';
import bodyParser from 'body-parser';
import { Shipment, ShipmentLabel } from 'types';
const carrierCode = process.env.CARRIER_CODE!;
const carrierKey = carrierCode.toLowerCase(); // für Flags
logger.info(`Bootstrapping carrier ${carrierCode}...`);

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

app.post('/receive', async (req, res) => {
  // 🔁 Feature Flag Simulationen
  const [simulateDelay, simulateUnavailable, simulatePartialSuccess] =
    await Promise.all([
      flagClient.getBooleanValue(`simulate.carrier.${carrierKey}.delay`, false),
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
    res.status(503).json({
      error: 'Carrier is currently unavailable',
    });
    return;
  }
  if (simulateDelay) {
    const delay = Math.floor(Math.random() * 5000) + 1000; // Random delay between 1s and 5s
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  if (simulatePartialSuccess) {
    const random = Math.random();
    if (random < 0.1) {
      res.status(500).json({
        error: 'Simulated partial success',
      });
      return;
    } else if (random < 0.2) {
      res.status(503).json({
        error: 'Simulated unavailable',
      });
      return;
    }
  }
  const body = req.body as Shipment;
  const label: ShipmentLabel = {
    labelUrl: `https://${carrierCode}.com/label.pdf`,
    labelFormat: 'PDF',
    labelType: 'PDF',
    labelSize: '4x6',
    dpi: 300,
    zplCode: `
        ^XA
        ^FO50,50^ADN,36,20^FDHello World!^FS
        ^XZ
        `,
    trackingNumber: '1234567890',
    trackingUrl: `https://${carrierCode}.com/track/1234567890`,
  };
  res.status(200).json({
    label,
  });
});

app.listen(PORT, () => {
  logger.info(`🚚 External Carrier ${carrierCode} is running on port ${PORT}`);
});

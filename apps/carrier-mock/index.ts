import dotenv from 'dotenv';
dotenv.config();
import { logger } from 'instrumentation';
import express from 'express';
import bodyParser from 'body-parser';
import { Shipment, ShipmentLabel } from 'types';
const carrierCode = process.env.CARRIER_CODE!;
logger.info(`Bootstrapping carrier ${carrierCode}...`);

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

app.post('/receive', (req, res) => {
  const body = req.body as Shipment;
  //fail in 20% of the time
  if (Math.random() < 0.1) {
    res.status(500).json({
      message: 'Failed to process shipment',
    });
  } else {
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
  }
});

app.listen(PORT, () => {
  logger.info(`🚚 External Carrier ${carrierCode} is running on port ${PORT}`);
});

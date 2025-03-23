import dotenv from 'dotenv';
dotenv.config();
import { logger } from 'instrumentation';
import express from 'express';
import bodyParser from 'body-parser';
import { Shipment, ShipmentLabel } from 'types';
logger.info('Bootstrapping carrier DHL...');

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
      labelUrl: 'https://dhl.com/label.pdf',
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
      trackingUrl: 'https://dhl.com/track/1234567890',
    };
    res.status(200).json({
      label,
    });
  }
});

app.listen(PORT, () => {
  logger.info(`🚚 External Carrier DHL is running on port ${PORT}`);
});

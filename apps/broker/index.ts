import dotenv from 'dotenv';
dotenv.config();
import { logger, meter } from 'instrumentation';
import express from 'express';
import bodyParser from 'body-parser';
import { Shipment } from 'types';
logger.info('Bootstrapping broker...');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

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
app.post('/shipment', async (req, res) => {
  logger.info('Received shipment from WMS', { shipment: req.body });
  const shipment = req.body as Shipment;
  shipmentCounter.add(1, { status: 'received' });
  shipmentCarrierCounter.add(1, { carrierCode: shipment.carrier.carrierCode });
  shipmentDestinationCountryCounter.add(1, {
    destinationCountry: shipment.destination.country,
  });
  res.status(200).json({
    message: 'Shipment received successfully',
  });
});

app.listen(PORT, () => {
  logger.info(`Broker is running on port ${PORT}`);
});

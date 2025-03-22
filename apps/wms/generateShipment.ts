import { faker } from '@faker-js/faker';
import {
  Shipment,
  Parcel,
  Address,
  CarrierCode,
  ServiceLevel,
  Weight,
  Dimensions,
} from 'types';
import { pickWeightedRandom } from './utils/pickWeightedRandom';
import {
  carrierDistribution,
  serviceLevelDistribution,
} from './config/distributions';

export function generateMockShipment(): Shipment {
  const numParcels = faker.number.int({ min: 1, max: 3 });

  const parcels: Parcel[] = Array.from({ length: numParcels }, () => ({
    parcelId: faker.string.uuid(),
    weight: {
      value: faker.number.float({ min: 0.1, max: 30, fractionDigits: 1 }),
      unit: 'kg',
    },
    dimensions: {
      length: faker.number.int({ min: 10, max: 100 }),
      width: faker.number.int({ min: 10, max: 60 }),
      height: faker.number.int({ min: 5, max: 50 }),
      unit: 'cm',
    },
    contentsDescription: faker.commerce.productDescription(),
    value: {
      amount: faker.number.float({ min: 10, max: 500, fractionDigits: 2 }),
      currency: 'EUR',
    },
  }));

  const makeAddress = (): Address => ({
    name: faker.person.fullName(),
    company: faker.company.name(),
    street1: faker.location.streetAddress(),
    postalCode: faker.location.zipCode(),
    city: faker.location.city(),
    country: faker.location.countryCode(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
  });

  return {
    shipmentId: faker.string.uuid(),
    orderReference: faker.string.alphanumeric(10),
    createdAt: new Date().toISOString(),
    origin: makeAddress(),
    destination: makeAddress(),
    parcels,
    carrier: {
      carrierCode: pickWeightedRandom(carrierDistribution),
      serviceLevel: pickWeightedRandom(serviceLevelDistribution),
    },
    status: 'pending',
    metadata: {
      source: 'mock-wms',
    },
    tags: ['test', 'mock'],
  };
}

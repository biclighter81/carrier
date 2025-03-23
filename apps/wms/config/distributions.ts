import { CarrierCode, ServiceLevel } from 'types';

export const carrierDistribution: Record<CarrierCode, number> = {
  [CarrierCode.DHL]: 0.8,
  [CarrierCode.UPS]: 0,
  [CarrierCode.FedEx]: 0.15,
  [CarrierCode.GLS]: 0.05,
};

export const serviceLevelDistribution: Record<ServiceLevel, number> = {
  [ServiceLevel.Standard]: 0.8,
  [ServiceLevel.Express]: 0.15,
  [ServiceLevel.Overnight]: 0.05,
};

export const countryDistribution: Record<string, number> = {
  DE: 0.1425,
  FR: 0.095,
  IT: 0.076,
  ES: 0.076,
  NL: 0.0665,
  BE: 0.0475,
  PL: 0.0665,
  SE: 0.0475,
  NO: 0.0285,
  FI: 0.0285,
  DK: 0.0285,
  IE: 0.0285,
  PT: 0.0285,
  AT: 0.0475,
  CH: 0.0475,
  CZ: 0.0285,
  SK: 0.019,
  HU: 0.019,
  RO: 0.019,
  BG: 0.019,
  GR: 0.019,
  HR: 0.019,
  SI: 0.019,
  LT: 0.019,
  OTHER: 0.05,
};

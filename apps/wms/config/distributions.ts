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

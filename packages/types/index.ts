export enum CarrierCode {
  DHL = 'DHL',
  UPS = 'UPS',
  FedEx = 'FedEx',
  GLS = 'GLS',
}

export enum ServiceLevel {
  Standard = 'standard',
  Express = 'express',
  Overnight = 'overnight',
}

export type CountryCode = string;
export type CurrencyCode = string;

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit?: 'cm' | 'in';
}

export interface Weight {
  value: number;
  unit?: 'kg' | 'lb';
}

export interface Parcel {
  parcelId: string;
  weight: Weight;
  dimensions?: Dimensions;
  trackingNumber?: string;
  contentsDescription?: string;
  value?: {
    amount: number;
    currency: CurrencyCode;
  };
  hazardous?: boolean;
  isReturn?: boolean;
}

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  postalCode: string;
  city: string;
  state?: string;
  country: CountryCode;
  phone?: string;
  email?: string;
}

export interface CarrierInfo {
  carrierCode: CarrierCode;
  serviceLevel: ServiceLevel;
  accountNumber?: string;
  labelFormat?: 'PDF' | 'ZPL' | 'PNG';
  requiresCustomsDeclaration?: boolean;
  pickupRequest?: boolean;
}

export interface Shipment {
  shipmentId: string;
  orderReference?: string;
  createdAt: string;
  scheduledShipDate?: string;
  isTest?: boolean;

  origin: Address;
  destination: Address;

  parcels: Parcel[];

  carrier: CarrierInfo;

  metadata?: Record<string, any>;
  tags?: string[];
  status?: 'pending' | 'processing' | 'shipped' | 'error' | 'cancelled';
}

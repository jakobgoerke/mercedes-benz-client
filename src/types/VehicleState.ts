export interface Position {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: Date;
}

export type AttributeValue = number | string | boolean | null;

export interface VehicleUpdate {
  vin: string;
  fullUpdate: boolean;
  emittedAt: Date;
  attributes: Record<string, AttributeValue>;
  position?: Position;
}

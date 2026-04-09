export type GpsCoordinates = {
  lat: number;
  lon: number;
};

export type DeviceData = {
  id: string;
  macAddress: string;
  message: string;
  time: string; // ISO8601 recommended
  gps?: GpsCoordinates;
  meta?: Record<string, unknown>;
  receivedAt: string;
};

export type CreateDeviceDataBody = {
  macAddress: string;
  message: string;
  time: string;
  gps?: GpsCoordinates;
  meta?: Record<string, unknown>;
};


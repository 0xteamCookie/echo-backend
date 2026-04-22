export type Announcement = {
  id: string;
  message: string;
  locationName: string;
  gps: {
    lat: number;
    lon: number;
  };
  createdAt: string;
  createdBy?: string;
};

export type CreateAnnouncementBody = {
  message: string;
  locationName: string;
  gps: {
    lat: number;
    lon: number;
  };
};

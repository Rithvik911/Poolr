import type { PoolrApi } from "./contracts";
import { apiConfig } from "./config";
import { mockRideApi } from "./mock";
import { realApi } from "./real";

export const api: PoolrApi = {
  ...realApi,
  listOwnRides: apiConfig.useMocks ? mockRideApi.listOwnRides : realApi.listOwnRides,
  searchRides: apiConfig.useMocks ? mockRideApi.searchRides : realApi.searchRides,
  bookRide: apiConfig.useMocks ? mockRideApi.bookRide : realApi.bookRide,
  listBookings: apiConfig.useMocks ? mockRideApi.listBookings : realApi.listBookings,
  cancelBooking: apiConfig.useMocks ? mockRideApi.cancelBooking : realApi.cancelBooking,
};

export { apiConfig } from "./config";
export { ApiError, friendlyError } from "./errors";
export { tokenStore } from "./token-store";
export type * from "./contracts";

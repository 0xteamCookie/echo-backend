import type { AccountProfile } from "./account.schema";

export const accountService = {
  getProfile(): AccountProfile {
    return { id: "demo", email: "demo@example.com" };
  },
};

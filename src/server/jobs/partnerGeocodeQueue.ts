import { connectMongo } from "../db/mongoose";
import { runPartnerGeocode } from "./partnerGeocodeJob";

declare global {
  // eslint-disable-next-line no-var
  var __partnerGeocodeQueue: { running: Set<string> } | undefined;
}

const state = global.__partnerGeocodeQueue ?? { running: new Set<string>() };
if (!global.__partnerGeocodeQueue) global.__partnerGeocodeQueue = state;

export function enqueuePartnerGeocode(jobId: string) {
  if (state.running.has(jobId)) return;
  state.running.add(jobId);

  // Fire-and-forget in dev. Replace with durable queue later.
  setTimeout(async () => {
    try {
      await connectMongo();
      await runPartnerGeocode(jobId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Partner geocode job failed", e);
    } finally {
      state.running.delete(jobId);
    }
  }, 0);
}

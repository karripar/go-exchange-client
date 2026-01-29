import { connectMongo } from "../db/mongoose";
import { runPartnerImport } from "./partnerImportJob";

declare global {
  // eslint-disable-next-line no-var
  var __partnerImportQueue: { running: Set<string> } | undefined;
}

const state = global.__partnerImportQueue ?? { running: new Set<string>() };
if (!global.__partnerImportQueue) global.__partnerImportQueue = state;

export function enqueuePartnerImport(importId: string) {
  if (state.running.has(importId)) return;
  state.running.add(importId);

  // Fire-and-forget in dev. Replace with BullMQ/Cloud Tasks later.
  setTimeout(async () => {
    try {
      await connectMongo();
      await runPartnerImport(importId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Partner import failed", e);
    } finally {
      state.running.delete(importId);
    }
  }, 0);
}

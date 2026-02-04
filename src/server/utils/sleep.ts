export async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

"use client";

import dynamic from "next/dynamic";

const PartnerMapGoogleClient = dynamic(() => import("./PartnerMapGoogleClient"), { ssr: false });

export default function PartnerMapGoogleShell() {
  return <PartnerMapGoogleClient />;
}

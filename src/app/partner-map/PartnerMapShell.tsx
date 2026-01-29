"use client";

import dynamic from "next/dynamic";

const PartnerMap = dynamic(() => import("./PartnerMapClient"), { ssr: false });

export default function PartnerMapShell() {
  return <PartnerMap />;
}

export type RawPartnerRow = {
  externalKey?: string;
  continentSection?: string;
  country?: string;
  institutionName?: string;
  city?: string;
  mobilityProgrammeText?: string;
  languageText?: string;
  agreementScopeText?: string;
  degreeProgrammeText?: string;
  furtherInfoText?: string;
  statusText?: string;
  latText?: string;
  lonText?: string;
};

export type LanguageRequirement = { language: string; level: string; notes?: string };

export type NormalizedPartnerRow = {
  externalKey?: string;
  name: string;
  continent: string;
  country: string;
  city: string;
  status: "confirmed" | "negotiation" | "unknown";
  mobilityProgrammes: string[];
  languageRequirements: LanguageRequirement[];
  agreementScope?: string;
  degreeProgrammesInAgreement: string[];
  furtherInfo?: string;
  coordinates?: { lat: number; lon: number };
};

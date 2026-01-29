function slugifyPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\|/g, "-")
    .replace(/[^a-z0-9\-\s]/g, "")
    .replace(/\s/g, "-");
}

export function makeExternalKey(name: string, country: string, city: string) {
  return `${slugifyPart(name)}|${slugifyPart(country)}|${slugifyPart(city)}`;
}

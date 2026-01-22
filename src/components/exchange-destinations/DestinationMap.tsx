"use client";
import React, { useEffect, useMemo, useState } from "react";
import { DestinationWithCoordinatesResponse } from "va-hybrid-types/contentTypes";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { DefaultIcon } from "../../../leafletConfig";
import MapSearchbar from "./MapSearchbar";
import { useLanguage } from "@/context/LanguageContext";
import FavoriteButton from "../ui/FavoriteButton";
import { useFavorites } from "@/hooks/destination-hooks/useFavorites";

interface DestinationMapProps {
  data: DestinationWithCoordinatesResponse;
}

interface SelectedCountry {
  country: string;
  universities: {
    title: string;
    program: string;
    link: string;
    studyField: string;
  }[];
}

const DestinationMap: React.FC<DestinationMapProps> = ({ data }) => {
  const [programFilter, setProgramFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCountry, setSelectedCountry] =
    useState<SelectedCountry | null>(null);

  const { language } = useLanguage();
  const { favorites } = useFavorites();

  const defaultCenter: [number, number] = [60.1699, 24.9384];

  useEffect(() => {
    if (searchTerm) setProgramFilter(null);
  }, [searchTerm]);

  const filteredDestinations =
    programFilter && programFilter !== "all"
      ? { [programFilter]: data.destinations[programFilter] || [] }
      : data.destinations;

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(data.destinations)
      .flat()
      .forEach((u) => u.country && set.add(u.country));
    return Array.from(set).sort();
  }, [data.destinations]);

  if (!data || !data.destinations) {
    return <div>No destination data available.</div>;
  }

  const countries: Record<
    string,
    {
      coordinates: { lat: number; lng: number };
      universities: {
        title: string;
        program: string;
        link: string;
        studyField: string;
      }[];
    }
  > = {};

  Object.entries(filteredDestinations).forEach(([program, universities]) => {
    universities
      .filter((uni) => {
        // Favorites filter
        if (showFavoritesOnly && favorites?.length) {
          if (!favorites.includes(uni.title)) return false;
        }

        // Country filter
        if (countryFilter && countryFilter !== "all") {
          if (uni.country !== countryFilter) return false;
        }

        // Search filter
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          return (
            uni.title.toLowerCase().includes(q) ||
            uni.country.toLowerCase().includes(q)
          );
        }

        return true;
      })
      .forEach((uni) => {
        if (!uni.coordinates) return;

        if (!countries[uni.country]) {
          countries[uni.country] = {
            coordinates: uni.coordinates,
            universities: [],
          };
        }

        countries[uni.country].universities.push({
          title: uni.title,
          program,
          link: uni.link,
          studyField: uni.studyField || "Unknown",
        });
      });
  });

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-lg">
      {/* Filters */}
      <div className="mb-4 flex gap-3 flex-wrap items-center">
        <select
          value={programFilter || "all"}
          onChange={(e) => setProgramFilter(e.target.value || null)}
          className="p-2 border rounded"
        >
          <option value="all">
            {language === "fi" ? "Kaikki ohjelmat" : "All Programs"}
          </option>
          {Object.keys(data.destinations).map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>

        <select
          value={countryFilter || "all"}
          onChange={(e) => setCountryFilter(e.target.value || null)}
          className="p-2 border rounded"
        >
          <option value="all">
            {language === "fi" ? "Kaikki maat" : "All Countries"}
          </option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>

        {/* Favorites toggle */}
        <button
          onClick={() => {
            setShowFavoritesOnly((v) => !v);
            setCountryFilter(null);
            setProgramFilter(null);
            setSearchTerm("");
          }}
          className={`px-4 py-2 rounded text-white transition ${
            showFavoritesOnly
              ? "bg-gray-700 hover:bg-gray-800"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {showFavoritesOnly
            ? language === "fi"
              ? "Näytä kaikki"
              : "Show all"
            : language === "fi"
            ? "Näytä suosikit"
            : "Show favorites"}
        </button>
      </div>

      {/* Map */}
      <div className="relative w-full h-[420px] rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

        <MapContainer
          center={defaultCenter}
          zoom={4}
          scrollWheelZoom
          className="w-full h-full rounded-2xl"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap & CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
            maxZoom={20}
          />

          {Object.entries(countries).map(
            ([country, { coordinates, universities }]) => (
              <Marker
                key={country}
                position={[coordinates.lat, coordinates.lng]}
                icon={DefaultIcon}
                eventHandlers={{
                  click: () => setSelectedCountry({ country, universities }),
                }}
              />
            )
          )}
        </MapContainer>

        <div className="absolute top-4 right-4 z-20 backdrop-blur-md bg-white/80 rounded-xl shadow-lg border border-white/30">
          <MapSearchbar onSearch={(query) => setSearchTerm(query)} />
        </div>

        {selectedCountry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-3xl max-h-[85%] overflow-y-auto p-6">
              <button
                onClick={() => setSelectedCountry(null)}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/80 text-white"
              >
                ✕
              </button>

              <h2 className="text-2xl font-bold mb-6 text-center">
                {selectedCountry.country}
              </h2>

              <ul className="space-y-4">
                {selectedCountry.universities.map((uni, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-gray-100 p-4 shadow-sm bg-gray-50/50"
                  >
                    <h3 className="font-semibold text-lg">{uni.title}</h3>
                    <p className="text-gray-700">{uni.program}</p>

                    <section className="flex justify-between items-center mt-4">
                      {uni.link && (
                        <a
                          href={uni.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#FF5000] text-white rounded-lg"
                        >
                          {language === "fi" ? "Lue lisää" : "Learn More"}
                        </a>
                      )}

                      <FavoriteButton destinationName={uni.title} />
                    </section>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinationMap;

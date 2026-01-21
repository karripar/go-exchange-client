"use client";
import React, { useEffect, useState } from "react";
import { DestinationWithCoordinatesResponse } from "va-hybrid-types/contentTypes";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { DefaultIcon } from "../../../leafletConfig";
import MapSearchbar from "./MapSearchbar";
import { useLanguage } from "@/context/LanguageContext";
import FavoriteButton from "../ui/FavoriteButton";

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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCountry, setSelectedCountry] =
    useState<SelectedCountry | null>(null);
  const { language } = useLanguage();

  const defaultCenter: [number, number] = [60.1699, 24.9384]; // Helsinki fallback

  // Clear program filter when searching
  useEffect(() => {
    if (searchTerm) {
      setProgramFilter(null);
    }
  }, [searchTerm]);

  if (!data || !data.destinations) {
    return <div>No destination data available.</div>;
  }

  // Apply filter
  const filteredDestinations =
    programFilter && programFilter !== "all"
      ? { [programFilter]: data.destinations[programFilter] || [] }
      : data.destinations;

  // Group by country
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
      .filter((uni) =>
        searchTerm
          ? uni.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            uni.country.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
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
          studyField: uni.studyField || "Unknown", // Provide a default value if studyField is missing
        });
      });
  });

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-lg">
      {/* Program filter dropdown */}
      <div className="mb-4">
        <label htmlFor="program-filter" className="sr-only">
          {language === "fi" ? "Suodata ohjelman mukaan" : "Filter by Program"}
        </label>
        <select
          id="program-filter"
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
      </div>

      {/* Map */}
      <div className="relative w-full h-[420px] rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
        {/* Subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

        <MapContainer
          center={defaultCenter}
          zoom={4}
          scrollWheelZoom={true}
          className="w-full h-full rounded-2xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
            maxZoom={20}
          />

          {/* Markers per country */}
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

        {/* Searchbar overlay */}
        <div className="absolute top-4 right-4 z-20 backdrop-blur-md bg-white/80 rounded-xl shadow-lg border border-white/30">
          <MapSearchbar onSearch={(query) => setSearchTerm(query)} />
        </div>

        {/* Modal */}
        {selectedCountry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-3xl max-h-[85%] overflow-y-auto p-6">
              <button
                onClick={() => setSelectedCountry(null)}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/80 text-white hover:bg-black transition"
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
                    className="rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition bg-gray-50/50"
                  >
                    <section className="my-2 px-1">
                      <h3 className="font-semibold text-lg">{uni.title}</h3>
                      <p className="text-gray-700">{uni.program}</p>

                      {uni.studyField &&
                        uni.studyField !== uni.title &&
                        uni.studyField !== uni.program &&
                        uni.studyField !== selectedCountry.country && (
                          <span className="text-sm text-gray-500">
                            {uni.studyField}
                          </span>
                        )}
                    </section>

                    <section className="flex flex-row gap-2 items-center justify-between mt-6">
                      {uni.link && (
                        <a
                          href={uni.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-[#FF5000] text-white rounded-lg shadow hover:bg-[#e04e00] transition"
                        >
                          Vieraile verkkosivulla
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

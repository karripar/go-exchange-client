"use client";
import React, { useState } from "react";
import { DestinationWithCoordinatesResponse } from "va-hybrid-types/contentTypes";
import { useLanguage } from "@/context/LanguageContext";
import FavoriteButton from "@/components/ui/FavoriteButton";

interface DestinationListProps {
  data: DestinationWithCoordinatesResponse;
}

const DestinationList: React.FC<DestinationListProps> = ({ data }) => {
  const [openCountries, setOpenCountries] = useState<Record<string, boolean>>(
    {}
  );
  const [openPrograms, setOpenPrograms] = useState<Record<string, boolean>>({});
  const { language } = useLanguage();

  const toggleCountry = (countryKey: string) => {
    setOpenCountries((prev) => ({ ...prev, [countryKey]: !prev[countryKey] }));
  };

  const toggleProgram = (programKey: string) => {
    setOpenPrograms((prev) => ({ ...prev, [programKey]: !prev[programKey] }));
  };

  const translations: Record<string, Record<string, string>> = {
    en: {
      visitWebsite: "Visit Website",
    },
    fi: {
      visitWebsite: "Vieraile verkkosivuilla",
    },
  };

  return (
    <>
  {/* Programs & Countries */}
  {data &&
    Object.entries(data.destinations).map(([program, universities]) => {
      const countries: Record<string, typeof universities> = {};
      universities.forEach((uni) => {
        if (!countries[uni.country]) countries[uni.country] = [];
        countries[uni.country].push(uni);
      });

      const isProgramOpen = openPrograms[program];

      return (
        <div
          key={program}
          className="my-6 rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white"
        >
          {/* Program Header */}
          <button
            onClick={() => toggleProgram(program)}
            className="w-full text-left px-5 py-4 bg-gradient-to-r from-[#FF5000] to-[#ff6a2a] text-white font-semibold flex justify-between items-center text-lg"
          >
            <span>
              {program}
              <span className="ml-2 text-sm opacity-90">
                ({universities.length})
              </span>
            </span>

            <span
              className={`transition-transform duration-300 text-xl ${
                isProgramOpen ? "rotate-180" : "rotate-0"
              }`}
            >
              ▾
            </span>
          </button>

          {/* Countries inside program */}
          <div
            className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${
              isProgramOpen ? "max-h-[4000px]" : "max-h-0"
            }`}
          >
            {Object.entries(countries).map(([country, unis]) => {
              const countryKey = `${program}-${country}`;
              const isCountryOpen = openCountries[countryKey];

              const validCount = unis.filter(
                (u) =>
                  u.title &&
                  u.title.trim() !== "," &&
                  u.title.trim() !== ""
              ).length;

              return (
                <div key={countryKey} className="border-t">
                  {/* Country Header */}
                  <button
                    className="w-full text-left px-5 py-3 bg-gray-50 hover:bg-gray-100 transition font-medium flex justify-between items-center"
                    onClick={() => toggleCountry(countryKey)}
                  >
                    <span className="text-gray-800">
                      {country}
                      <span className="ml-2 text-sm text-gray-500">
                        ({validCount})
                      </span>
                    </span>

                    <span
                      className={`transition-transform duration-300 text-gray-500 ${
                        isCountryOpen ? "rotate-180" : "rotate-0"
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {/* Universities */}
                  <ul
                    className={`overflow-hidden transition-[max-height] duration-400 ease-in-out bg-gray-50 ${
                      isCountryOpen ? "max-h-[2000px]" : "max-h-0"
                    }`}
                  >
                    {unis.map((uni, index) => (
                      <li
                        key={`${uni.title}-${uni.country}-${index}`}
                        className="px-5 py-4 border-t border-gray-100 hover:bg-white transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-base sm:text-lg text-gray-900">
                              {uni.title}
                            </h3>

                            {uni.studyField &&
                              uni.studyField !== uni.title &&
                              uni.studyField !== uni.country && (
                                <span className="text-sm text-gray-500 block mt-1">
                                  {uni.studyField}
                                </span>
                              )}

                            {uni.link && (
                              <a
                                href={uni.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-2 text-sm font-medium hover:underline"
                                style={{ color: "var(--va-orange)" }}
                              >
                                {translations[language]?.visitWebsite ||
                                  "Visit Website"}
                              </a>
                            )}
                          </div>

                          <div className="mt-2 sm:mt-0 sm:ml-3 flex-shrink-0">
                            <FavoriteButton destinationName={uni.title} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
</>

  );
};

export default DestinationList;

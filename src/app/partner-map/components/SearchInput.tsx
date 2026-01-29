"use client";

import React, { useEffect, useState } from "react";

type Props = {
  value: string;
  onDebouncedChange: (nextValue: string) => void;
  placeholder?: string;
  debounceMs?: number;
};

export default function SearchInput({
  value,
  onDebouncedChange,
  placeholder = "Search…",
  debounceMs = 300,
}: Props) {
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    const t = window.setTimeout(() => onDebouncedChange(internal), debounceMs);
    return () => window.clearTimeout(t);
  }, [internal, debounceMs, onDebouncedChange]);

  return (
    <div className="relative">
      <input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF5000]/50"
      />
      {internal.length > 0 && (
        <button
          type="button"
          onClick={() => setInternal("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-[var(--typography)]/70 hover:bg-black/5"
        >
          Clear
        </button>
      )}
    </div>
  );
}

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, beforeEach, expect, vi } from "vitest";

// Mock language context
vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    toggleLanguage: vi.fn(),
  }),
}));

// Mock next/navigation router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useFavorites hook
const mockUseFavorites = vi.fn();
vi.mock("@/hooks/destination-hooks/useFavorites", () => ({
  useFavorites: () => mockUseFavorites(),
}));

// Mock translations for favorites
vi.mock("@/lib/translations/favorites", () => ({
  translations: {
    en: {
      title: "My Favorites",
      noFavorites: "You have no favorite destinations yet.",
      view: "View",
      browseMore: "Browse more destinations",
      errorRemoving: "Error removing favorite",
    },
  },
}));

// Mock ProfileHeader and LoadingSpinner to simplify the DOM
vi.mock("@/components/profile/ProfileHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/profile/LoadingSpinner", () => ({
  __esModule: true,
  default: () => <div>Loading...</div>,
}));

// Import the page under test
import FavoritesPage from "@/app/profile/favorites/page";

describe("FavoritesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
  });

  test("shows loading spinner when favorites are loading", () => {
    mockUseFavorites.mockReturnValue({
      favorites: [],
      removeFavorite: vi.fn(),
      loading: true,
    });

    render(<FavoritesPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders header and empty state when there are no favorites", () => {
    mockUseFavorites.mockReturnValue({
      favorites: [],
      removeFavorite: vi.fn(),
      loading: false,
    });

    render(<FavoritesPage />);

    expect(screen.getByText("My Favorites")).toBeInTheDocument();
    expect(
      screen.getByText("You have no favorite destinations yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Browse more destinations" })
    ).toBeInTheDocument();
  });

  test("renders list of favorites with view links and remove buttons", () => {
    const favorites = [
      { _id: "1", destination: "Helsinki", url: "https://example.com/hki" },
      { _id: "2", destination: "Tokyo", url: "https://example.com/tokyo" },
    ];

    mockUseFavorites.mockReturnValue({
      favorites,
      removeFavorite: vi.fn(),
      loading: false,
    });

    render(<FavoritesPage />);

    expect(screen.getByText("Helsinki")).toBeInTheDocument();
    expect(screen.getByText("Tokyo")).toBeInTheDocument();

    const viewButtons = screen.getAllByRole("link", { name: "View" });
    expect(viewButtons).toHaveLength(2);
    expect(viewButtons[0]).toHaveAttribute("href", "https://example.com/hki");
    expect(viewButtons[1]).toHaveAttribute("href", "https://example.com/tokyo");

    const removeButtons = screen.getAllByRole("button", { name: "" });
    // At least one trash button should be rendered for the favorites list
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
  });

  test("navigates to destinations page when browse more button is clicked", () => {
    mockUseFavorites.mockReturnValue({
      favorites: [],
      removeFavorite: vi.fn(),
      loading: false,
    });

    render(<FavoritesPage />);

    const browseButton = screen.getByRole("button", {
      name: "Browse more destinations",
    });
    fireEvent.click(browseButton);

    expect(mockPush).toHaveBeenCalledWith("/destinations");
  });

  test("calls removeFavorite when trash button is clicked and handles success", async () => {
    const favorites = [
      { _id: "1", destination: "Helsinki", url: "https://example.com/hki" },
    ];
    const removeFavoriteMock = vi.fn().mockResolvedValue(true);

    mockUseFavorites.mockReturnValue({
      favorites,
      removeFavorite: removeFavoriteMock,
      loading: false,
    });

    render(<FavoritesPage />);

    const buttons = screen.getAllByRole("button");
    const trashButton = buttons.find((btn) => btn.textContent === "");
    expect(trashButton).toBeDefined();

    if (!trashButton) return;

    fireEvent.click(trashButton);

    await waitFor(() => {
      expect(removeFavoriteMock).toHaveBeenCalledWith(
        "Helsinki",
        "https://example.com/hki"
      );
    });
  });

  test("shows alert when removeFavorite fails", async () => {
    const favorites = [
      { _id: "1", destination: "Helsinki", url: "https://example.com/hki" },
    ];
    const removeFavoriteMock = vi.fn().mockResolvedValue(false);

    mockUseFavorites.mockReturnValue({
      favorites,
      removeFavorite: removeFavoriteMock,
      loading: false,
    });

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<FavoritesPage />);

    const buttons = screen.getAllByRole("button");
    const trashButton = buttons.find((btn) => btn.textContent === "");

    if (!trashButton) return;

    fireEvent.click(trashButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Error removing favorite");
    });

    alertSpy.mockRestore();
  });
});

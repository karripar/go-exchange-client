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

// Mock next/navigation search params
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock profile + stages hooks
const mockUseProfileData = vi.fn();
const mockUseApplicationStages = vi.fn();

vi.mock("@/hooks/profileHooks", () => ({
  useProfileData: () => mockUseProfileData(),
}));

vi.mock("@/hooks/applicationsHooks", () => ({
  useApplicationsData: vi.fn(),
  useApplicationStages: () => mockUseApplicationStages(),
}));

// Mock phaseTasks
const mockPhaseTasks = {
  esihaku: [
    {
      id: "task-esihaku-1",
      title: "Pre-application task",
      documents: [{ id: "doc1", required: true }],
    },
  ],
  nomination: [
    {
      id: "task-nomination-1",
      title: "Nomination task",
      documents: [{ id: "doc2", required: true }],
    },
  ],
  apurahat: [
    {
      id: "task-apurahat-1",
      title: "Grant task",
      documents: [{ id: "doc3", required: true }],
    },
  ],
  vaihdon_jalkeen: [
    {
      id: "task-vaihdon-1",
      title: "After exchange task",
      documents: [{ id: "doc4", required: true }],
    },
  ],
};

vi.mock("@/config/phaseTasks", () => ({
  getPhaseTasks: () => mockPhaseTasks,
}));

// Mock translations used in the profile applications page
vi.mock("@/lib/translations/applications", () => ({
  translations: {
    en: {
      title: "Applications & Grants",
      loading: "Loading...",
      error: "Error:",
      tryAgain: "Try again",
      description: "Application instructions",
      requirement1: "Requirement 1",
      requirement2: "Requirement 2",
      requirement3: "Requirement 3",
      requirement4: "Requirement 4",
      esihaku: "Pre-application",
      nomination: "Nomination",
      apurahat: "Grants",
      vaihdon_jalkeen: "After exchange",
      grantsInfoTitle: "Grants information",
      grantsInfoText: "Here you manage grants.",
      esihakuInfoTitle: "Pre-application info",
      esihakuInfoText: "Pre-application details.",
      esihakuInfoList1: "List 1",
      esihakuInfoList2: "List 2",
      esihakuInfoList3: "List 3",
      nominationInfoTitle: "Nomination info",
      nominationInfoText: "Nomination details.",
      nominationInfoList1: "N1",
      nominationInfoList2: "N2",
      nominationInfoList3: "N3",
      nominationInfoList4: "N4",
      vaihdoJalkeenInfoTitle: "After exchange info",
      vaihdoJalkeenDuringTitle: "During",
      vaihdoJalkeenDuringText: "During text",
      vaihdoJalkeenAfterTitle: "After",
      vaihdoJalkeenAfterText: "After text",
      vaihdoJalkeenExtraList1: "E1",
      vaihdoJalkeenExtraList2: "E2",
      vaihdoJalkeenExtraList3: "E3",
    },
  },
}));

// Mock ProfileHeader and TaskCard so we can assert on their props usage via text/labels
vi.mock("@/components/profile/ProfileHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/applications/TaskTile", () => ({
  TaskCard: ({ task, isExpanded }: { task: any; isExpanded: boolean }) => (
    <div>
      <button
        aria-label={`toggle-${task.id}`}
        data-expanded={isExpanded ? "true" : "false"}
      >
        {task.title}
      </button>
    </div>
  ),
}));

// import the page under test
import HakemuksetPage from "@/app/profile/hakemukset/page";

describe("HakemuksetPage (Applications & Grants)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null);

    mockUseProfileData.mockReturnValue({
      profileData: { id: 1, name: "Test User" },
      loading: false,
      error: null,
    });

    mockUseApplicationStages.mockReturnValue({
      loading: false,
      error: null,
    });
  });

  test("renders header and description when data is loaded", () => {
    render(<HakemuksetPage />);

    expect(screen.getByText("Applications & Grants")).toBeInTheDocument();
    expect(screen.getByText("Application instructions")).toBeInTheDocument();
    expect(screen.getByText("Requirement 1")).toBeInTheDocument();
  });

  test("shows loading state while profile or stages are loading", () => {
    mockUseProfileData.mockReturnValueOnce({
      profileData: null,
      loading: true,
      error: null,
    });

    render(<HakemuksetPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("shows error state when hooks return error", () => {
    mockUseProfileData.mockReturnValueOnce({
      profileData: null,
      loading: false,
      error: "Profile error",
    });

    render(<HakemuksetPage />);

    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  test("renders phase navigation tabs with correct labels", () => {
    render(<HakemuksetPage />);

    expect(
      screen.getByRole("tab", { name: /1. Pre-application/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /2. Nomination/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /3. Grants/ })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /4. After exchange/ })
    ).toBeInTheDocument();
  });

  test("renders pre-application info box for esihaku phase by default", () => {
    render(<HakemuksetPage />);

    expect(screen.getByText("Pre-application info")).toBeInTheDocument();
    expect(screen.getByText("Pre-application details.")).toBeInTheDocument();
    expect(screen.getByText("Pre-application task")).toBeInTheDocument();
  });

  test("switches to grants phase when Grants tab is clicked", () => {
    render(<HakemuksetPage />);

    const grantsTab = screen.getByRole("tab", { name: /3. Grants/ });
    fireEvent.click(grantsTab);

    expect(screen.getByText("Grants information")).toBeInTheDocument();
    expect(screen.getByText("Here you manage grants.")).toBeInTheDocument();
    expect(screen.getByText("Grant task")).toBeInTheDocument();
  });

  test("uses search param tab=budget to open grants phase on initial render", () => {
    mockGet.mockReturnValueOnce("budget");

    render(<HakemuksetPage />);

    expect(screen.getByText("Grants information")).toBeInTheDocument();
    expect(screen.getByText("Grant task")).toBeInTheDocument();
  });

  test("uses search param tab=apurahat to open grants phase", () => {
    mockGet.mockReturnValueOnce("apurahat");

    render(<HakemuksetPage />);

    expect(screen.getByText("Grants information")).toBeInTheDocument();
    expect(screen.getByText("Grant task")).toBeInTheDocument();
  });

  test("shows nomination info when nomination phase is selected", () => {
    render(<HakemuksetPage />);

    const nominationTab = screen.getByRole("tab", { name: /2. Nomination/ });
    fireEvent.click(nominationTab);

    expect(screen.getByText("Nomination info")).toBeInTheDocument();
    expect(screen.getByText("Nomination details.")).toBeInTheDocument();
    expect(screen.getByText("Nomination task")).toBeInTheDocument();
  });

  test("shows after-exchange info when vaihdon_jalkeen phase is selected", () => {
    render(<HakemuksetPage />);

    const afterTab = screen.getByRole("tab", { name: /4. After exchange/ });
    fireEvent.click(afterTab);

    expect(screen.getByText("After exchange info")).toBeInTheDocument();
    expect(screen.getByText(/During text/)).toBeInTheDocument();
    expect(screen.getByText(/After text/)).toBeInTheDocument();
    expect(screen.getByText("After exchange task")).toBeInTheDocument();
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import {
  useApplicationsData,
  useApplicationStages,
} from "@/hooks/applicationsHooks";
import { useProfileData } from "@/hooks/profileHooks";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { TaskCard } from "@/components/applications/TaskTile";
import { getPhaseTasks } from "@/config/phaseTasks";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ApplicationPhase } from "va-hybrid-types/contentTypes";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations/applications";


const getPhaseTitle = (phase: ApplicationPhase, language: string) => {
  const t = translations[language];
  switch (phase) {
    case "esihaku":
      return `1. ${t.esihaku}`;
    case "nomination":
      return `2. ${t.nomination}`;
    case "apurahat":
      return `3. ${t.apurahat}`;
    case "vaihdon_jalkeen":
      return `4. ${t.vaihdon_jalkeen}`;
  }
};

export default function HakemuksetPage() {
  const [activePhase, setActivePhase] = useState<ApplicationPhase>("esihaku");
  const {
    profileData: profile,
    loading: profileLoading,
    error: profileError,
  } = useProfileData();
  const {
    loading: appsLoading,
    error: appsError,
  } = useApplicationsData();
  const {
    loading: stagesLoading,
    error: stagesError,
  } = useApplicationStages();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const t = translations[language];
  const PHASE_TASKS = getPhaseTasks(language);

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [activeBudgetTab, setActiveBudgetTab] = useState<"stages">("stages");


  // Task's specific document management
  const [taskDocuments, setTaskDocuments] = useState<
    Record<string, Record<string, { url: string; source: string }>>
  >({});
  const [showReminder, setShowReminder] = useState<string | null>(null);

  // Calculate task completion based on saved documents (persists across reloads)
  const isTaskCompleted = (
    taskId: string,
    task: { documents: Array<{ id: string; required: boolean }> }
  ) => {
    const taskDocs = taskDocuments[taskId] || {};
    const requiredDocs = task.documents.filter((d) => d.required);
    return requiredDocs.length > 0 && requiredDocs.every((d) => taskDocs[d.id]);
  };

  // Handle URL parameters for direct navigation from navbar
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "budget") {
      setActivePhase("apurahat");
    } else if (tab === "apurahat") {
      setActivePhase("apurahat");
      setActiveBudgetTab("stages");
    }
  }, [searchParams]);

  useEffect(() => {
    if (activePhase !== "apurahat") {
      setActiveBudgetTab("stages");
    }
  }, [activePhase]);

  const getPhaseProgress = (phase: ApplicationPhase) => {
    const tasks = PHASE_TASKS[phase];
    const completedTasks = tasks.filter((t) => isTaskCompleted(t.id, t));
    return tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
  };

  if (profileLoading || appsLoading || stagesLoading) {
    return (
      <div className="flex flex-col items-center p-4 mt-8">
        <p>{t.loading}</p>
      </div>
    );
  }

  if (profileError || appsError || stagesError) {
    return (
      <div className="flex flex-col items-center p-4 mt-8">
        <p className="text-red-500">
          {t.error} {profileError || appsError || stagesError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          {t.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProfileHeader title={t.title} showBack />

      {/* Description */}
      <div className="bg-white p-6 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-3 space-x-4 text-lg outline-2 p-6 bg-orange-50 border-l-4 border-[#FF5722] rounded-md">
            <h3 className="text-gray-900 text-center flex-1">
              {t.description}
            </h3>
          </div>
          <div className="text-sm text-gray-600 space-y-1 max-w-2xl mx-auto">
            <p>{t.requirement1}</p>
            <p>{t.requirement2}</p>
            <p>{t.requirement3}</p>
            <p>{t.requirement4}</p>
          </div>
        </div>
      </div>

      {/* Phase Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div
              role="tablist"
              className="
          flex gap-1
          overflow-x-auto
          px-2
          scrollbar-none
          -mb-px
        "
            >
              {(
                [
                  "esihaku",
                  "nomination",
                  "apurahat",
                  "vaihdon_jalkeen",
                ] as ApplicationPhase[]
              ).map((phase) => {
                const isActive = activePhase === phase;

                return (
                  <button
                    key={phase}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActivePhase(phase)}
                    className={`
                shrink-0
                px-4 py-6
                text-sm font-medium
                whitespace-nowrap
                border-b-2
                transition-colors
                ${
                  isActive
                    ? "border-[#FF5722] text-[#FF5722]"
                    : "border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300"
                }
              `}
                  >
                    {getPhaseTitle(phase, language)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {activePhase === "apurahat" ? (
          <div>

            {activeBudgetTab === "stages" && (
              <div className="space-y-6">
                <div className="bg-orange-50 border-l-4 border-[#FF5722] p-4 mb-6">
                  <h4 className="font-semibold text-[#FF5722] mb-2">
                    {t.grantsInfoTitle}
                  </h4>
                  <p className="text-sm text-gray-700">{t.grantsInfoText}</p>
                </div>

                {/* Render Grant Tasks */}
                {PHASE_TASKS.apurahat.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isExpanded={expandedTask === task.id}
                    onToggleExpand={() =>
                      setExpandedTask(expandedTask === task.id ? null : task.id)
                    }
                    taskDocuments={taskDocuments[task.id] || {}}
                    isCompleted={isTaskCompleted(task.id, task)}
                    showReminder={showReminder === task.id}
                    onCloseReminder={() => setShowReminder(null)}
                    
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {activePhase === "esihaku" && (
              <div className="bg-orange-50 border-l-4 border-[#FF5722] p-4 mb-6">
                <h4 className="font-semibold text-[#FF5722] mb-2">
                  {t.esihakuInfoTitle}
                </h4>
                <p className="text-sm text-gray-700 mb-2">
                  {t.esihakuInfoText}
                </p>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li>{t.esihakuInfoList1}</li>
                  <li>{t.esihakuInfoList2}</li>
                  <li>{t.esihakuInfoList3}</li>
                </ul>
              </div>
            )}
            {activePhase === "nomination" && (
              <div className="bg-orange-50 border-l-4 border-[#FF5722] p-4 mb-6">
                <h4 className="font-semibold text-[#FF5722] mb-2">
                  {t.nominationInfoTitle}
                </h4>
                <p className="text-sm text-gray-700 mb-2">
                  {t.nominationInfoText}
                </p>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li>{t.nominationInfoList1}</li>
                  <li>{t.nominationInfoList2}</li>
                  <li>{t.nominationInfoList3}</li>
                  <li>{t.nominationInfoList4}</li>
                </ul>
              </div>
            )}
            {activePhase === "vaihdon_jalkeen" && (
              <div className="bg-orange-50 border-l-4 border-[#FF5722] p-4 mb-6">
                <h4 className="font-semibold text-[#FF5722] mb-2">
                  {t.vaihdoJalkeenInfoTitle}
                </h4>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>{t.vaihdoJalkeenDuringTitle}</strong>{" "}
                  {t.vaihdoJalkeenDuringText}
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>{t.vaihdoJalkeenAfterTitle}</strong>{" "}
                  {t.vaihdoJalkeenAfterText}
                </p>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li>{t.vaihdoJalkeenExtraList1}</li>
                  <li>{t.vaihdoJalkeenExtraList2}</li>
                  <li>{t.vaihdoJalkeenExtraList3}</li>
                </ul>
              </div>
            )}

            {/* Render Phase Tasks */}
            {PHASE_TASKS[activePhase].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedTask === task.id}
                onToggleExpand={() =>
                  setExpandedTask(expandedTask === task.id ? null : task.id)
                }
                taskDocuments={taskDocuments[task.id] || {}}
                isCompleted={isTaskCompleted(task.id, task)}
                showReminder={showReminder === task.id}
                onCloseReminder={() => setShowReminder(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

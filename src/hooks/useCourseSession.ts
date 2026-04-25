import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ActiveContentContext,
  AgentStatus,
  ChatMessage,
  CourseSession,
  CourseSetup,
  CourseSummary,
  ExportStatus,
  NotesDocument,
  StudentProfile,
  UploadedCourseFile,
  VoiceStatus,
} from "../lib/types";
import { STORAGE_KEYS } from "../lib/localStorage";
import { clearAllFiles } from "../lib/fileStore";

type View = "profile" | "setup" | "classroom";

export type SessionState = {
  view: View;
  setup: CourseSetup;
  profile: StudentProfile;
  files: UploadedCourseFile[];
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
  summary?: CourseSummary;
  createdAt?: string;
  messages: ChatMessage[];
  notes: NotesDocument;
  agentStatus: AgentStatus;
  voiceStatus: VoiceStatus;
  exportStatus: ExportStatus;
  globalError?: string;
  isBootstrapping: boolean;
  chatDraftAppend?: string;
  requestedTab?: "course" | "chat" | "notes";
  activeContent?: ActiveContentContext;
  ttsAutoplay: boolean;

  setSetupField: <K extends keyof CourseSetup>(
    key: K,
    value: CourseSetup[K]
  ) => void;
  setProfileField: <K extends keyof StudentProfile>(
    key: K,
    value: StudentProfile[K]
  ) => void;
  completeProfile: () => void;
  setFiles: (files: UploadedCourseFile[]) => void;
  updateFile: (
    name: string,
    partial: Partial<UploadedCourseFile>
  ) => void;
  startClass: (data: {
    fileIds: string[];
    vectorStoreId: string;
    summary: CourseSummary;
    courseContent?: string;
  }) => void;
  setView: (view: View) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  setNotes: (notes: Partial<NotesDocument>) => void;
  appendNotesContent: (text: string) => void;
  clearNotes: () => void;
  appendChatDraft: (text: string) => void;
  consumeChatDraft: () => void;
  requestTab: (tab: "course" | "chat" | "notes") => void;
  consumeRequestedTab: () => void;
  setActiveContent: (ctx?: ActiveContentContext) => void;
  setTtsAutoplay: (enabled: boolean) => void;
  setAgentStatus: (s: AgentStatus) => void;
  setVoiceStatus: (s: VoiceStatus) => void;
  setExportStatus: (s: ExportStatus) => void;
  setGlobalError: (err?: string) => void;
  resetAll: () => void;
};

const emptySetup: CourseSetup = {
  courseName: "",
  courseObjective: "",
  agentStyle: "",
};

const emptyProfile: StudentProfile = {
  fullName: "",
  role: "",
  industry: "",
  businessType: "",
  mainGoal: "",
  level: "",
  mainChallenge: "",
};

const emptyNotes: NotesDocument = {
  title: "",
  courseName: "",
  businessCase: "",
  content: "",
  updatedAt: new Date().toISOString(),
};

type PersistedSlice = {
  session?: CourseSession;
  messages: ChatMessage[];
  notes: NotesDocument;
  view: View;
};

export const useCourseSession = create<SessionState>()(
  persist(
    (set) => ({
      view: "profile",
      setup: emptySetup,
      profile: emptyProfile,
      files: [],
      messages: [],
      notes: emptyNotes,
      agentStatus: "idle",
      voiceStatus: "idle",
      exportStatus: "idle",
      isBootstrapping: false,
      ttsAutoplay: false,

      setSetupField: (key, value) =>
        set((state) => ({ setup: { ...state.setup, [key]: value } })),

      setProfileField: (key, value) =>
        set((state) => ({ profile: { ...state.profile, [key]: value } })),

      completeProfile: () => set({ view: "setup" }),

      setFiles: (files) => set({ files }),

      updateFile: (name, partial) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.name === name ? { ...f, ...partial } : f
          ),
        })),

      startClass: ({ fileIds, vectorStoreId, summary, courseContent }) =>
        set((state) => ({
          view: "classroom",
          fileIds,
          vectorStoreId,
          courseContent,
          summary,
          createdAt: new Date().toISOString(),
          notes: {
            ...state.notes,
            courseName: state.setup.courseName,
            businessCase: state.profile.businessType,
            title: summary.suggestedTitle || state.setup.courseName,
            updatedAt: new Date().toISOString(),
          },
        })),

      setView: (view) => set({ view }),

      setMessages: (messages) => set({ messages }),

      appendMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      setNotes: (partial) =>
        set((state) => ({
          notes: {
            ...state.notes,
            ...partial,
            updatedAt: new Date().toISOString(),
          },
        })),

      appendNotesContent: (text) =>
        set((state) => {
          const clean = text.trim();
          if (!clean) return {};
          const existing = state.notes.content?.trim() ?? "";
          const nextContent = existing
            ? `${existing}\n\n${clean}`
            : clean;
          return {
            notes: {
              ...state.notes,
              content: nextContent,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      appendChatDraft: (text) =>
        set(() => ({ chatDraftAppend: text })),

      consumeChatDraft: () =>
        set(() => ({ chatDraftAppend: undefined })),

      requestTab: (tab) =>
        set(() => ({ requestedTab: tab })),

      consumeRequestedTab: () =>
        set(() => ({ requestedTab: undefined })),

      setActiveContent: (activeContent) => set({ activeContent }),
      setTtsAutoplay: (ttsAutoplay) => set({ ttsAutoplay }),

      clearNotes: () =>
        set((state) => ({
          notes: {
            title: state.setup.courseName || "",
            courseName: state.setup.courseName,
            businessCase: state.profile.businessType,
            content: "",
            updatedAt: new Date().toISOString(),
          },
        })),

      setAgentStatus: (agentStatus) => set({ agentStatus }),
      setVoiceStatus: (voiceStatus) => set({ voiceStatus }),
      setExportStatus: (exportStatus) => set({ exportStatus }),
      setGlobalError: (globalError) => set({ globalError }),

      resetAll: () => {
        void clearAllFiles().catch(() => {});
        set({
          view: "profile",
          setup: emptySetup,
          profile: emptyProfile,
          files: [],
          fileIds: undefined,
          vectorStoreId: undefined,
          courseContent: undefined,
          summary: undefined,
          createdAt: undefined,
          messages: [],
          notes: { ...emptyNotes, updatedAt: new Date().toISOString() },
          agentStatus: "idle",
          voiceStatus: "idle",
          exportStatus: "idle",
          globalError: undefined,
          chatDraftAppend: undefined,
          requestedTab: undefined,
          activeContent: undefined,
          ttsAutoplay: false,
        });
      },
    }),
    {
      name: STORAGE_KEYS.session,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedSlice => ({
        session:
          state.vectorStoreId && state.fileIds
            ? {
                ...state.setup,
                studentProfile: state.profile,
                uploadedFiles: state.files,
                fileIds: state.fileIds,
                vectorStoreId: state.vectorStoreId,
                courseContent: state.courseContent,
                courseSummary: state.summary,
                createdAt: state.createdAt ?? new Date().toISOString(),
              }
            : undefined,
        messages: state.messages,
        notes: state.notes,
        view: state.view,
      }),
      merge: (persisted, current) => {
        const p = persisted as PersistedSlice | undefined;
        if (!p) return current;
        const setup: CourseSetup = p.session
          ? {
              courseName: p.session.courseName,
              courseObjective: p.session.courseObjective,
              agentStyle: p.session.agentStyle,
            }
          : current.setup;
        const profile: StudentProfile = p.session?.studentProfile ?? current.profile;
        return {
          ...current,
          setup,
          profile,
          files: p.session?.uploadedFiles ?? current.files,
          fileIds: p.session?.fileIds,
          vectorStoreId: p.session?.vectorStoreId,
          courseContent: p.session?.courseContent,
          summary: p.session?.courseSummary,
          createdAt: p.session?.createdAt,
          messages: p.messages ?? [],
          notes: p.notes ?? current.notes,
          view: p.view ?? (p.session ? "classroom" : current.view),
        };
      },
    }
  )
);

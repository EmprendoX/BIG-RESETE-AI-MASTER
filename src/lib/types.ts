export type CourseSetup = {
  courseName: string;
  courseObjective: string;
  agentStyle: string;
};

export type StudentProfile = {
  fullName: string;
  role: string;
  industry: string;
  businessType: string;
  mainGoal: string;
  level: string;
  mainChallenge: string;
};

export type ActiveContentContext = {
  kind: "pdf" | "docx" | "txt" | "pptx" | "image" | "youtube" | "other";
  name: string;
  pageHint?: string;
};

export type FileStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "searching_course"
  | "responding"
  | "error";

export type VoiceStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "ready"
  | "error";

export type ExportStatus =
  | "idle"
  | "generating_pdf"
  | "pdf_ready"
  | "generating_docx"
  | "docx_ready"
  | "error";

export type UploadedCourseFile = {
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  error?: string;
  fileId?: string;
};

export type CourseSummary = {
  suggestedTitle: string;
  mainObjective: string;
  detectedTopics: string[];
  suggestedModules: string[];
  firstLesson: string;
  initialQuestions: string[];
  finalDeliverable: string;
  missingContentWarnings: string[];
};

export type CourseSession = {
  courseName: string;
  courseObjective: string;
  agentStyle: string;
  studentProfile: StudentProfile;
  uploadedFiles: UploadedCourseFile[];
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
  courseSummary?: CourseSummary;
  createdAt: string;
};

export type AgentResponse = {
  title: string;
  explanation: string;
  caseApplication: string;
  exercise: string;
  noteSuggestion: string;
  nextStep: string;
  outOfCourseWarning?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  structured?: AgentResponse;
};

export type NotesDocument = {
  title: string;
  courseName: string;
  businessCase: string;
  content: string;
  updatedAt: string;
};

export type UploadCourseFileResponse = {
  success: boolean;
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
  error?: string;
};

export type GenerateCourseSummaryRequest = {
  courseName: string;
  courseObjective: string;
  studentType: string;
  studentLevel: string;
  businessCase: string;
  agentStyle: string;
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
};

export type GenerateCourseSummaryResponse = {
  success: boolean;
  summary?: CourseSummary;
  error?: string;
};

export type ChatRequest = {
  courseName: string;
  courseObjective: string;
  studentType: string;
  studentLevel: string;
  businessCase: string;
  agentStyle: string;
  studentName?: string;
  industry?: string;
  businessType?: string;
  mainGoal?: string;
  mainChallenge?: string;
  activeContent?: ActiveContentContext;
  vectorStoreId?: string;
  fileIds?: string[];
  messages: ChatMessage[];
  userMessage: string;
  notesContext?: string;
  courseContent?: string;
};

export type ChatResponseBody = {
  success: boolean;
  response?: AgentResponse;
  error?: string;
};

export type TranscribeResponse = {
  success: boolean;
  text?: string;
  error?: string;
};

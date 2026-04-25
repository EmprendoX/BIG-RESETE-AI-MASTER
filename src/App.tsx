import { useCourseSession } from "./hooks/useCourseSession";
import StudentProfileWizard from "./components/StudentProfileWizard";
import CourseSetup from "./components/CourseSetup";
import Classroom from "./components/Classroom";
import ErrorMessage from "./components/ErrorMessage";

export default function App() {
  const view = useCourseSession((s) => s.view);
  const globalError = useCourseSession((s) => s.globalError);
  const setGlobalError = useCourseSession((s) => s.setGlobalError);

  return (
    <div className="app-shell">
      {globalError ? (
        <div className="global-error-bar">
          <ErrorMessage message={globalError} />
          <button
            className="global-error-close"
            onClick={() => setGlobalError(undefined)}
            aria-label="Cerrar error"
          >
            ×
          </button>
        </div>
      ) : null}
      {view === "profile" ? (
        <StudentProfileWizard />
      ) : view === "setup" ? (
        <CourseSetup />
      ) : (
        <Classroom />
      )}
    </div>
  );
}

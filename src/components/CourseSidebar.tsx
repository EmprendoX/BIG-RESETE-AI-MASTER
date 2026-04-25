import { BookOpen, Target, Users, GraduationCap, Briefcase, FileText } from "lucide-react";
import { useCourseSession } from "../hooks/useCourseSession";

export default function CourseSidebar() {
  const { setup, profile, files, summary } = useCourseSession();

  return (
    <div className="sidebar">
      <section className="sidebar-section">
        <h3 className="sidebar-title">Curso</h3>
        <InfoRow icon={<BookOpen size={14} />} label="Nombre" value={setup.courseName} />
        <InfoRow icon={<Target size={14} />} label="Objetivo" value={setup.courseObjective} />
        <InfoRow icon={<Users size={14} />} label="Alumno" value={profile.fullName} />
        <InfoRow icon={<Users size={14} />} label="Rol" value={profile.role} />
        <InfoRow icon={<GraduationCap size={14} />} label="Nivel" value={profile.level} />
        <InfoRow icon={<Briefcase size={14} />} label="Negocio o caso" value={profile.businessType} />
      </section>

      <section className="sidebar-section">
        <h3 className="sidebar-title">Archivos cargados</h3>
        {files.length === 0 ? (
          <p className="muted">Sin archivos.</p>
        ) : (
          <ul className="sidebar-files">
            {files.map((f) => (
              <li key={f.name}>
                <FileText size={13} />
                <span>{f.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary ? (
        <section className="sidebar-section">
          <h3 className="sidebar-title">Resumen inicial</h3>
          {summary.mainObjective ? (
            <p className="sidebar-summary">{summary.mainObjective}</p>
          ) : null}

          {summary.detectedTopics.length > 0 ? (
            <div className="sidebar-sub">
              <h4>Temas detectados</h4>
              <ul className="chip-list">
                {summary.detectedTopics.map((t, i) => (
                  <li key={i} className="chip">{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.suggestedModules.length > 0 ? (
            <div className="sidebar-sub">
              <h4>Módulos sugeridos</h4>
              <ol className="sidebar-list">
                {summary.suggestedModules.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {summary.firstLesson ? (
            <div className="sidebar-sub">
              <h4>Primera lección</h4>
              <p>{summary.firstLesson}</p>
            </div>
          ) : null}

          {summary.initialQuestions.length > 0 ? (
            <div className="sidebar-sub">
              <h4>Preguntas iniciales</h4>
              <ul className="sidebar-list">
                {summary.initialQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.finalDeliverable ? (
            <div className="sidebar-sub">
              <h4>Entregable final</h4>
              <p>{summary.finalDeliverable}</p>
            </div>
          ) : null}

          {summary.missingContentWarnings.length > 0 ? (
            <div className="sidebar-sub warning">
              <h4>Advertencias</h4>
              <ul className="sidebar-list">
                {summary.missingContentWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="info-row">
      <span className="info-icon">{icon}</span>
      <div className="info-body">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
    </div>
  );
}

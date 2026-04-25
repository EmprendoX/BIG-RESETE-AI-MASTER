import { Sparkles } from "lucide-react";
import { useCourseSession } from "../hooks/useCourseSession";

export default function StudentProfileWizard() {
  const profile = useCourseSession((s) => s.profile);
  const setProfileField = useCourseSession((s) => s.setProfileField);
  const completeProfile = useCourseSession((s) => s.completeProfile);

  const isValid =
    profile.fullName.trim() &&
    profile.role.trim() &&
    profile.industry.trim() &&
    profile.businessType.trim() &&
    profile.mainGoal.trim() &&
    profile.level.trim() &&
    profile.mainChallenge.trim();

  return (
    <main className="setup">
      <header className="setup-header">
        <div className="setup-badge">
          <Sparkles size={14} /> Perfil del estudiante
        </div>
        <h1 className="setup-title">Configura el contexto del alumno</h1>
        <p className="setup-subtitle">
          Este paso personaliza todas las respuestas del mentor IA para el
          negocio real del alumno.
        </p>
      </header>

      <section className="setup-card">
        <div className="form-grid">
          <Field
            label="Nombre del alumno *"
            value={profile.fullName}
            onChange={(v) => setProfileField("fullName", v)}
            placeholder="Ej: Andrea Castillo"
          />
          <Field
            label="Rol *"
            value={profile.role}
            onChange={(v) => setProfileField("role", v)}
            placeholder="Ej: Dueña de negocio"
          />
          <Field
            label="Industria *"
            value={profile.industry}
            onChange={(v) => setProfileField("industry", v)}
            placeholder="Ej: Gastronomía"
          />
          <Field
            label="Tipo de negocio *"
            value={profile.businessType}
            onChange={(v) => setProfileField("businessType", v)}
            placeholder="Ej: Restaurante familiar"
          />
          <Field
            label="Objetivo principal *"
            value={profile.mainGoal}
            onChange={(v) => setProfileField("mainGoal", v)}
            placeholder="Ej: Aumentar ventas 20% en 3 meses"
            textarea
          />
          <Field
            label="Nivel actual *"
            value={profile.level}
            onChange={(v) => setProfileField("level", v)}
            placeholder="Ej: Principiante"
          />
          <Field
            label="Reto principal *"
            value={profile.mainChallenge}
            onChange={(v) => setProfileField("mainChallenge", v)}
            placeholder="Ej: No tengo proceso comercial claro"
            textarea
          />
        </div>

        <div className="setup-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!isValid}
            onClick={completeProfile}
          >
            Continuar a configuración del curso
          </button>
        </div>
      </section>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const { label, value, onChange, placeholder, textarea } = props;
  return (
    <label className={`field ${textarea ? "field-full" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

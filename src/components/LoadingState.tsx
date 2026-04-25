import { Loader2 } from "lucide-react";

type Props = {
  label?: string;
  inline?: boolean;
};

export default function LoadingState({ label, inline }: Props) {
  return (
    <div className={inline ? "loading inline" : "loading"}>
      <Loader2 className="loading-spinner" size={inline ? 14 : 18} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

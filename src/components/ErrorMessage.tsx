import { AlertTriangle } from "lucide-react";

type Props = {
  message: string;
};

export default function ErrorMessage({ message }: Props) {
  return (
    <div className="error-message" role="alert">
      <AlertTriangle size={16} />
      <span>{message}</span>
    </div>
  );
}

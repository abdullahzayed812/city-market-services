import { Timer } from "lucide-react";
import { useSlaCountdown } from "@/hooks/useSlaCountdown";

interface Props {
  deadline: string | Date | null | undefined;
  label: string;
}

export function SlaCountdownBadge({ deadline, label }: Props) {
  const { remainingSeconds, isExpired, isWarning, formattedTime } = useSlaCountdown(deadline);

  if (!deadline || isExpired || remainingSeconds === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border ${
        isWarning
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
    >
      <Timer className="w-3 h-3 flex-shrink-0" />
      <span className="uppercase tracking-wide">{label}</span>
      <span className="tabular-nums font-mono">{formattedTime}</span>
    </div>
  );
}

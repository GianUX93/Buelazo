import { Sparkles } from "lucide-react";

export function ChatAgentAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const icon = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      className={`grid ${dims} shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-primary-token)] to-[var(--color-accent-token)] shadow-sm`}
    >
      <Sparkles className={`${icon} text-white`} />
    </div>
  );
}

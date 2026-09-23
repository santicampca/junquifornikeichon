import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "primary" | "win" | "draw" | "loss" | "muted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-surface-elevated text-foreground border-border",
  primary: "bg-primary/15 text-primary border-primary/30",
  win: "bg-win/15 text-win border-win/30",
  draw: "bg-draw/15 text-draw border-draw/30",
  loss: "bg-loss/15 text-loss border-loss/30",
  muted: "bg-transparent text-muted border-border",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

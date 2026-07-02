import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
        "placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

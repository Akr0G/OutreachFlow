import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 shadow-sm",
        "placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

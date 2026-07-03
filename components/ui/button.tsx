import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
    "hover:-translate-y-0.5 active:translate-y-0",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500",
    variant === "primary" && "bg-accent text-accent-foreground hover:bg-teal-700",
    variant === "secondary" && "border border-border bg-white text-slate-800 hover:bg-slate-50",
    variant === "ghost" && "text-slate-700 hover:bg-slate-100",
    variant === "danger" && "bg-destructive text-white hover:bg-red-700",
    size === "sm" && "h-9 px-3",
    size === "md" && "h-10 px-4",
    size === "icon" && "h-10 w-10",
    className
  );
}

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return <button className={buttonClasses({ variant, size, className })} {...props} />;
}

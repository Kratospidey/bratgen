import { ComponentProps, forwardRef } from "react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";

export const Card = forwardRef<HTMLDivElement, ComponentProps<"div">>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={twMerge(
        "rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_45px_rgba(203,255,0,0.1)] backdrop-blur",
        className
      )}
      {...props}
    />
  );
});

export const Button = forwardRef<HTMLButtonElement, ComponentProps<"button">>(function Button(
  { className, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition",
          disabled
            ? "bg-zinc-800 text-zinc-500"
            : "bg-brat text-black shadow-[0_0_25px_rgba(203,255,0,0.45)] hover:scale-[1.02]"
        ),
        className
      )}
      {...props}
    />
  );
});

export const Label = forwardRef<HTMLLabelElement, ComponentProps<"label">>(function Label(
  { className, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={twMerge("block text-xs font-semibold uppercase tracking-widest text-zinc-400", className)}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={twMerge(
        "w-full rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-brat focus:outline-none",
        className
      )}
      {...props}
    />
  );
});

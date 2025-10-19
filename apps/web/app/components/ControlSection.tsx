"use client";

import { Disclosure, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, ReactNode } from "react";

interface ControlSectionProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}

export function ControlSection({
  title,
  eyebrow,
  description,
  children,
  defaultOpen = true,
  id
}: ControlSectionProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div
          id={id}
          className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_0_65px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(203,255,0,0.18),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_60%)]" />
          <div className="relative">
            <Disclosure.Button className="flex w-full items-start justify-between gap-6 px-7 py-6 text-left">
              <div className="space-y-2">
                {eyebrow && (
                  <p className="text-[11px] uppercase tracking-[0.45em] text-brat/80">{eyebrow}</p>
                )}
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {description && <p className="text-sm text-zinc-400">{description}</p>}
              </div>
              <span
                className={clsx(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition",
                  open && "rotate-180 border-brat/60 bg-brat/30 text-black"
                )}
              >
                <ChevronDownIcon className="h-4 w-4" />
              </span>
            </Disclosure.Button>
            <Transition
              show={open}
              as={Fragment}
              enter="transition duration-200 ease-out"
              enterFrom="-translate-y-2 opacity-0"
              enterTo="translate-y-0 opacity-100"
              leave="transition duration-150 ease-in"
              leaveFrom="translate-y-0 opacity-100"
              leaveTo="-translate-y-2 opacity-0"
            >
              <Disclosure.Panel className="px-7 pb-7 pt-2">
                <div className="space-y-6">
                  {children}
                </div>
              </Disclosure.Panel>
            </Transition>
          </div>
        </div>
      )}
    </Disclosure>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.172l3.71-2.94a.75.75 0 1 1 .94 1.18l-4.25 3.37a.75.75 0 0 1-.94 0l-4.25-3.37a.75.75 0 0 1 .02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FaCheck, FaChevronDown } from "react-icons/fa";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number> {
  // T is inferred from `options` only, so a setState setter fits `onChange`.
  value: NoInfer<T>;
  options: readonly SelectOption<T>[];
  onChange: (value: NoInfer<T>) => void;
  size?: keyof typeof SIZES;
  className?: string;
  "aria-label"?: string;
}

const SIZES = {
  sm: { text: "text-[11px]", trigger: "px-1.5 py-0.5" },
  md: { text: "text-xs", trigger: "px-2 py-1" },
};

// Glass-styled replacement for <select>, whose native option popup can't be
// themed. Supports mouse and the usual listbox keys (arrows, Home/End,
// Enter/Space, Escape, Tab).
export default function Select<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted option visible while navigating a scrolled list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = () => {
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(last, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={clsx("relative", SIZES[size].text, className)}
    >
      <button
        type="button"
        role="combobox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        className={clsx(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-black/25 text-paradise-100 transition-colors hover:bg-black/35 focus:outline-none focus-visible:border-paradise-200/50",
          SIZES[size].trigger,
          open ? "border-paradise-200/35" : "border-[#2d2d2d]/80",
        )}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <FaChevronDown
          className={clsx(
            "shrink-0 text-[0.7em] text-paradise-200/60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          className="twitch-scroll absolute right-0 z-30 mt-1 max-h-56 min-w-full overflow-y-auto rounded-lg border border-[#2d2d2d]/80 bg-[#161616]/95 p-1 shadow-xl backdrop-blur-lg backdrop-saturate-150 animate-[fadeIn_0.12s_ease-out]"
        >
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={clsx(
                  "flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-md px-2 py-1 transition-colors",
                  index === activeIndex ? "bg-white/[0.08]" : "",
                  isSelected ? "text-paradise-100" : "text-paradise-200/75",
                )}
              >
                {option.label}
                <FaCheck
                  className={clsx(
                    "text-[0.8em] text-paradise-200",
                    !isSelected && "invisible",
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

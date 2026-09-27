"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import AnimatedCounter from "./Ticker";
import { APP_TIME_ZONE } from "@/config/time";

interface CurrentTimeProps {
  className?: string;
  displayMs?: boolean;
  msPrecision?: number;
}

interface TimeParts {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

function getTimeParts(): TimeParts {
  const now = new Date();
  const parts = timeFormatter.formatToParts(now);

  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const seconds = Number(
    parts.find((part) => part.type === "second")?.value ?? 0,
  );

  return {
    hours,
    minutes,
    seconds,
    milliseconds: now.getMilliseconds(),
  };
}

export default function CurrentTime({
  className,
  displayMs,
  msPrecision,
}: CurrentTimeProps) {
  // Starts empty so the prerendered HTML (build-time clock) can't mismatch the
  // client; a hydration mismatch makes React re-render the whole document,
  // which also wipes the accent attributes set on <html> before paint.
  const [time, setTime] = useState<TimeParts | null>(null);

  useEffect(() => {
    setTime(getTimeParts());
    const interval = setInterval(() => {
      setTime(getTimeParts());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={clsx(
        "flex items-center gap-2 font-sans text-paradise-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <span className="opacity-0 animate-[fadeIn_0.5s_ease-out_0.1s_forwards]">
        It’s currently:
      </span>
      {time ? (
        <div className="flex gap-1 opacity-0 animate-[fadeIn_0.5s_ease-out_0.25s_forwards]">
          <AnimatedCounter
            value={time.hours}
            className="font-mono text-highlight"
            decimalPrecision={0}
            padNumber={2}
            showColorsWhenValueChanges={false}
          />
          :
          <AnimatedCounter
            value={time.minutes}
            className="font-mono text-highlight"
            decimalPrecision={0}
            padNumber={2}
            showColorsWhenValueChanges={false}
          />
          :
          <AnimatedCounter
            value={time.seconds}
            className="font-mono text-highlight"
            decimalPrecision={0}
            padNumber={2}
            showColorsWhenValueChanges={false}
          />
          {displayMs && (
            <>
              .
              <AnimatedCounter
                value={time.milliseconds}
                className="font-mono text-highlight"
                decimalPrecision={msPrecision}
                padNumber={3}
                showColorsWhenValueChanges={false}
              />
            </>
          )}
        </div>
      ) : (
        // Same footprint as the clock so nothing shifts when it appears.
        <span className="invisible font-mono" aria-hidden>
          {displayMs ? "00 : 00 : 00 . 000" : "00 : 00 : 00"}
        </span>
      )}
    </div>
  );
}

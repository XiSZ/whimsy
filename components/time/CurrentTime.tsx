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
  const [time, setTime] = useState(getTimeParts());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeParts());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={clsx(
        "flex items-center gap-2 font-sans text-paradise-200",
        className,
      )}
    >
      <span className="opacity-0 animate-[fadeIn_0.5s_ease-out_0.1s_forwards]">
        It’s currently:
      </span>
      <div className="flex gap-1 opacity-0 animate-[fadeIn_0.5s_ease-out_0.25s_forwards]">
        <AnimatedCounter
          value={time.hours}
          className="font-mono text-paradise-300"
          decimalPrecision={0}
          padNumber={2}
          showColorsWhenValueChanges={false}
        />
        :
        <AnimatedCounter
          value={time.minutes}
          className="font-mono text-paradise-300"
          decimalPrecision={0}
          padNumber={2}
          showColorsWhenValueChanges={false}
        />
        :
        <AnimatedCounter
          value={time.seconds}
          className="font-mono text-paradise-300"
          decimalPrecision={0}
          padNumber={2}
          showColorsWhenValueChanges={false}
        />
        {displayMs && (
          <>
            .
            <AnimatedCounter
              value={time.milliseconds}
              className="font-mono text-paradise-300"
              decimalPrecision={msPrecision}
              padNumber={3}
              showColorsWhenValueChanges={false}
            />
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { APP_TIME_ZONE } from "@/config/time";

function getGreeting(): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(new Date());

  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);

  if (hours < 12) return "Good morning";
  if (hours < 18) return "Good afternoon";
  return "Good evening";
}

export default function Greeting() {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const update = () => setGreeting(getGreeting());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!greeting) return <div className="h-10" />;

  return (
    <div className="animate-stagger-in text-4xl text-paradise-100 font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      {greeting}, <span className="text-paradise-200">Selçuk</span>!
    </div>
  );
}

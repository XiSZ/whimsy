"use client";

import { useEffect, useState } from "react";
import { APP_TIME_ZONE } from "@/config/time";

function getGreeting(): string {
  const hours = Number(
    new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: APP_TIME_ZONE,
    }).format(new Date()),
  );

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
    <div className="animate-stagger-in text-4xl text-paradise-200 font-semibold tracking-tight">
      {greeting}, <span className="text-paradise-300">Selçuk</span>!
    </div>
  );
}

"use client";

import { useState } from "react";
import clsx from "clsx";
import { FaGoogle, FaYoutube, FaGithub } from "react-icons/fa";
import { SiBrave, SiTwitch, SiPerplexity, SiAnthropic, SiGooglegemini } from "react-icons/si";
import type { IconType } from "react-icons/lib";

const engines = [
  {
    key: "google",
    label: "Google",
    icon: FaGoogle,
    url: "https://www.google.com/search?q=",
  },
  {
    key: "brave",
    label: "Brave",
    icon: SiBrave,
    url: "https://search.brave.com/search?q=",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: FaYoutube,
    url: "https://www.youtube.com/results?search_query=",
  },
  {
    key: "github",
    label: "GitHub",
    icon: FaGithub,
    url: "https://github.com/search?q=",
  },
  {
    key: "twitch",
    label: "Twitch",
    icon: SiTwitch,
    url: "https://www.twitch.tv/search?term=",
  },
  {
    key: "perplexity",
    label: "Perplexity",
    icon: SiPerplexity,
    url: "https://www.perplexity.ai/search?q=",
  },
  {
    key: "claude",
    label: "Claude",
    icon: SiAnthropic,
    url: "https://claude.ai/new?q=",
  },
  {
    key: "gemini",
    label: "Gemini",
    icon: SiGooglegemini,
    url: "https://gemini.google.com/app?hl=en&input=",
  },
] as const;

type EngineKey = (typeof engines)[number]["key"];

const placeholders: Record<EngineKey, string[]> = {
  google: [
    "Where to buy pipebombs near me?",
    "Is it normal to talk to my houseplants?",
    "How to seem smart at dinner parties",
    "Why does my code work but I don't know why",
    "Am I the only one who rereads sent messages?",
    "How to exit vim",
    "Is cereal a soup? serious question",
    "Can I legally become a medieval knight",
  ],
  brave: [
    "Can the government see me searching this?",
    "Do VPNs actually do anything?",
    "How to be anonymous online (asking for a friend)",
    "Does incognito mode hide from my mom?",
    "Why is big tech watching me eat cereal",
    "How to opt out of everything forever",
    "Are my smart lights spying on me",
  ],
  youtube: [
    "Oddly satisfying cement mixing compilation",
    "Guy tries to eat 100 nuggets in one sitting",
    "Lo-fi beats to debug production at 3am",
    "How to pretend you understood the tutorial",
    "Cat falls off table — extended cut",
    "Entire Lord of the Rings but only the walking scenes",
    "Speed run of doing laundry",
    "Guy explains calculus using sandwiches",
  ],
  github: [
    "TODO: fix this later (2019)",
    "why is node_modules 4GB",
    "regex that definitely works this time",
    "left pad but make it enterprise",
    "rewriting it in Rust (again)",
    "my first hello world (very proud)",
    "fix: fix the fix that fixed the previous fix",
    "please work I have a meeting in 5 minutes",
  ],
  twitch: [
    "guy just vibing with 3 viewers",
    "backseating chess grandmaster",
    "waiting for game to start since 2021",
    "streamer falls asleep on stream compilation",
    "chat speedruns being toxic",
    "hot tub stream but it's just a bathtub",
    "Minecraft but the chat controls my life",
  ],
  perplexity: [
    "Is AI going to take my job (asking AI)",
    "Explain quantum physics but make it funny",
    "What did I miss while I was offline",
    "Am I cooked or is the situation cooked",
    "Summarize the entire internet please",
    "Why does everything feel like a simulation",
    "Give me a fact nobody asked for",
  ],
  claude: [
    "Are you sentient? be honest",
    "Write my apology email but make it not sound like an apology",
    "Explain why my code is bad without making me feel bad",
    "Help me sound smart in this meeting",
    "Is this a good idea or am I coping",
    "Roast my README",
    "Write a commit message that doesn't reveal my shame",
  ],
  gemini: [
    "Google but make it feel like the future",
    "Search this but also summarize it but also vibe check it",
    "Am I talking to Google or Google talking to me",
    "Can you access my calendar, my soul, and my fridge",
    "Help me decide what to eat (you have all my data already)",
    "Multimodal query: I don't know what I'm looking for",
  ],
};

function randomPlaceholder(engine: EngineKey) {
  const pool = placeholders[engine];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function SearchBar() {
  const [currentEngine, setCurrentEngine] = useState<EngineKey>("google");
  const [value, setValue] = useState("");
  const [placeholder, setPlaceholder] = useState(() => randomPlaceholder("google"));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;

    const query = value.trim();
    if (!query) return;

    const engine = engines.find((eng) => eng.key === currentEngine);

    if (engine) {
      window.open(engine.url + encodeURIComponent(query), "_blank");
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="
            w-full px-4 py-3 rounded-xl
            bg-[#161616]/62
            border border-[#2d2d2d]/70
            text-paradise-fg
            backdrop-blur-lg backdrop-saturate-150
            font-sans
            outline-none
            transition-all duration-300 ease-out
            hover:border-paradise-400/40
            focus:border-paradise-400
            focus:bg-[#111111]/72
            focus:shadow-[0_0_0_1px_rgba(141,163,185,0.3),0_0_24px_rgba(141,163,185,0.15)]
          "
        />

        <span
          className={clsx(
            "absolute left-4 top-1/2 -translate-y-1/2 text-paradise-100/50 pointer-events-none transition-opacity duration-300",
            value.length > 0 ? "opacity-0" : "opacity-100",
          )}
        >
          🔎 &nbsp; {placeholder}
        </span>
      </div>

      <div className="flex justify-center gap-2 mt-3">
        {engines.map((engine) => {
          const Icon: IconType = engine.icon;
          const isActive = currentEngine === engine.key;

          return (
            <button
              key={engine.key}
              onClick={() => {
                setCurrentEngine(engine.key);
                setPlaceholder(randomPlaceholder(engine.key));
              }}
              title={engine.label}
              className={clsx(
                "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm border transition-all duration-300 cursor-pointer",
                isActive
                  ? "bg-paradise-300 text-paradise-bg border-paradise-300 font-medium"
                  : "bg-[#161616]/62 border-[#2d2d2d]/70 text-paradise-100/85 hover:border-paradise-100/30 hover:text-paradise-100 backdrop-blur-lg backdrop-saturate-150",
              )}
            >
              <Icon className="text-xs" />
              <span className="hidden sm:inline">{engine.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import clsx from "clsx";
import Card from "@/components/ui/Card";
import { FaAngleRight } from "react-icons/fa";
import { SEARCH_QUERY_EVENT } from "./SearchBar";
import { useAppSettings } from "./settings";

interface BookmarkLink {
  label: string;
  url: string;
  // Domain to take the icon from when the link's own host has none the
  // favicon service can reach (LAN addresses).
  icon?: string;
}

interface BookmarkCategory {
  title: string;
  // Default title, hover arrow and card border color; Settings → Bookmark
  // colors can override it.
  color: string;
  links: BookmarkLink[];
}

// Identifies a group in the `--group-<key>` override variables.
export const groupKey = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const categories: BookmarkCategory[] = [
  {
    title: "Social",
    color: "#f472b6",
    links: [
      { label: "Twitch", url: "https://Twitch.tv/" },
      { label: "YouTube", url: "https://youtube.com/" },
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Twitter", url: "https://x.com/" },
    ],
  },
  {
    title: "Network",
    color: "#38bdf8",
    links: [
      { label: "FRITZ!Box", url: "http://192.168.178.1/", icon: "fritz.com" },
      {
        label: "FRITZ!Repeater",
        url: "http://192.168.178.2/",
        icon: "fritz.com",
      },
      {
        label: "MyFRITZ!Net",
        url: "https://www.myfritz.net/devices/#/",
        icon: "fritz.com",
      },
    ],
  },
  {
    title: "Tools",
    color: "#a3e635",
    links: [
      { label: "GitHub", url: "https://github.com/" },
      { label: "iLovePDF", url: "https://www.ilovepdf.com/" },
      { label: "TinyWOW", url: "https://tinywow.com/" },
      { label: "Ninite", url: "https://ninite.com/" },
    ],
  },
  {
    title: "Share",
    color: "#2dd4bf",
    links: [
      { label: "Vanish", url: "https://hy.gl/" },
      { label: "Send", url: "https://send.vis.ee/" },
      { label: "Cobalt", url: "https://cobalt.tools" },
    ],
  },
  {
    title: "Shopping",
    color: "#fb923c",
    links: [
      { label: "Amazon", url: "https://www.amazon.de/" },
      { label: "mydealz", url: "https://www.mydealz.de/" },
      { label: "Slickdeals", url: "https://slickdeals.net/" },
      { label: "MemRadar", url: "https://memradar.com/" },
    ],
  },
  {
    title: "Prices",
    color: "#facc15",
    links: [
      { label: "idealo", url: "https://www.idealo.de/" },
      { label: "Geizhals", url: "https://geizhals.de/" },
      { label: "Keepa", url: "https://keepa.com/#!" },
      { label: "Camelcamelcamel", url: "https://de.camelcamelcamel.com/" },
    ],
  },
  {
    title: "Builder",
    color: "#a78bfa",
    links: [
      { label: "PCPartPicker", url: "https://de.pcpartpicker.com/" },
      { label: "PCBuilder", url: "https://pcbuilder.net/" },
      { label: "BuildMyPC", url: "https://buildmypc.net/" },
      { label: "PCCombo", url: "https://www.pc-kombo.com/us/" },
    ],
  },
  {
    title: "Builds",
    color: "#818cf8",
    links: [
      {
        label: "Logical Increments",
        url: "https://www.logicalincrements.com/",
      },
      { label: "ChooseMyPC", url: "https://choosemypc.net/" },
      { label: "PCBuilds", url: "https://pc-builds.com/" },
      {
        label: "BuildMyPCAI",
        url: "https://www.buildmypconline.us/pc-builder-and-cost-calculator/",
      },
    ],
  },
  {
    title: "Compare",
    color: "#f87171",
    links: [
      { label: "UserBenchmark", url: "https://www.userbenchmark.com/" },
      { label: "Bottleneck", url: "https://bottleneckcalculator.cc/" },
      { label: "Pangoly", url: "https://pangoly.com/en/" },
    ],
  },
];

const STAGGER_MS = 60;

// Google's favicon service; it redirects to *.gstatic.com (both allowed in
// public/_headers) and serves a generic globe for sites it has no icon for.
function Favicon({ link }: { link: BookmarkLink }) {
  const domain = link.icon ?? new URL(link.url).hostname;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-4 w-4 shrink-0 rounded-sm icon-only:h-6 icon-only:w-6"
    />
  );
}

// Exposes the group color as `--group` (a color picked in Settings, set on
// <html> as `--group-<key>`, wins over the default) and tints the card border
// with it.
function groupStyle(category: BookmarkCategory, index: number): CSSProperties {
  return {
    "--group": `var(--group-${groupKey(category.title)}, ${category.color})`,
    borderColor: "color-mix(in oklab, var(--group) 35%, transparent)",
    animationDelay: `${index * STAGGER_MS}ms`,
  } as CSSProperties;
}

// Tiles sit in a fixed 3-column grid (nine categories of 3–4 links fill it
// evenly); a partial last row leaves its free cells empty.
// Both layouts are rendered and the inactive one is hidden via the `strips:`
// variant (driven by `data-bookmarks` on <html>), so the saved choice shows
// on first paint without a layout jump after hydration.
// Icon-only links (Settings → Links) are styled via the `icon-only:` variant,
// so the saved choice applies before hydration; the names stay in the DOM for
// screen readers and become tooltips.
export default function Bookmarks() {
  const [query, setQuery] = useState("");
  const [settings] = useAppSettings();
  const tooltip = (link: BookmarkLink) =>
    settings.bookmarkLinkStyle === "icon" ? link.label : undefined;

  useEffect(() => {
    const onQuery = (event: Event) =>
      setQuery((event as CustomEvent<string>).detail);
    window.addEventListener(SEARCH_QUERY_EVENT, onQuery);
    return () => window.removeEventListener(SEARCH_QUERY_EVENT, onQuery);
  }, []);

  // Typing in the search bar highlights bookmarks whose name matches and dims
  // the rest. Bang queries, and queries that match nothing (a web search),
  // leave them alone.
  const needle = query.trim().toLowerCase();
  const matches = (link: BookmarkLink) =>
    link.label.toLowerCase().includes(needle);
  const filtering =
    needle !== "" &&
    !needle.startsWith("!") &&
    categories.some((category) => category.links.some(matches));
  const hit = (link: BookmarkLink) => filtering && matches(link);
  const dim = (link: BookmarkLink) => filtering && !matches(link);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 auto-rows-fr gap-4 w-full strips:hidden">
        {categories.map((category, i) => (
          <Card
            key={category.title}
            className="animate-stagger-in min-h-[160px] md:min-h-[180px] links-row:min-h-0!"
            style={groupStyle(category, i)}
          >
            <div className="text-lg text-(--group) mb-1 text-center md:text-left">
              {category.title}
            </div>

            <div className="flex flex-col gap-2 items-center md:items-start justify-center md:justify-start links-row:flex-row links-row:flex-wrap links-row:gap-x-4 links-row:gap-y-2 icon-only:pt-1">
              {category.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  title={tooltip(link)}
                  className={clsx(
                    "group relative flex items-center justify-center md:justify-start text-sm py-0.5 transition-[opacity,transform] duration-200 transform",
                    dim(link) && "opacity-30",
                  )}
                >
                  <span className="hidden md:block absolute -left-1 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all duration-200 text-(--group) animate-page-in icon-only:hidden! links-row:hidden!">
                    <FaAngleRight className="w-3 h-3" />
                  </span>

                  <span
                    className={clsx(
                      "flex items-center gap-2 transition-colors transition-transform duration-200 transform group-hover:text-paradise-200 md:group-hover:translate-x-3 icon-only:translate-x-0! links-row:translate-x-0! icon-only:group-hover:scale-125",
                      hit(link)
                        ? "font-medium text-(--group)"
                        : "text-paradise-100/85",
                    )}
                  >
                    <Favicon link={link} />
                    <span className="icon-only:sr-only">{link.label}</span>
                  </span>
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Separate strips that share one grid: each strip is a subgrid, so
          titles and links line up in columns across all of them. Narrow
          screens scroll the whole stack sideways instead of wrapping. With
          icons only, a strip packs them after a fixed-width title instead
          (equal-sized icons still line up, without the wide columns). */}
      <div className="hidden strips:grid w-full overflow-x-auto [scrollbar-width:none] grid-cols-[auto_repeat(4,minmax(max-content,1fr))] gap-x-4 gap-y-2">
        {categories.map((category, i) => (
          <Card
            key={category.title}
            className="animate-stagger-in col-span-5 grid! grid-cols-subgrid items-center px-4 py-2.5 icon-only:flex! icon-only:flex-row icon-only:gap-5"
            style={groupStyle(category, i)}
          >
            <div className="whitespace-nowrap pr-2 text-[11px] uppercase tracking-wide text-(--group) icon-only:w-20 icon-only:shrink-0">
              {category.title}
            </div>
            {category.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                title={tooltip(link)}
                className={clsx(
                  "flex items-center gap-1.5 whitespace-nowrap text-sm transition-[color,opacity,scale] duration-200 hover:text-paradise-200 hover:underline decoration-(--group)/60 underline-offset-4 icon-only:w-fit icon-only:hover:scale-125",
                  hit(link)
                    ? "font-medium text-(--group)"
                    : "text-paradise-100/85",
                  dim(link) && "opacity-30",
                )}
              >
                <Favicon link={link} />
                <span className="icon-only:sr-only">{link.label}</span>
              </a>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

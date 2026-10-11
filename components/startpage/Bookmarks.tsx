import Card from "@/components/ui/Card";
import { FaAngleRight } from "react-icons/fa";

interface BookmarkLink {
  label: string;
  url: string;
}

interface BookmarkCategory {
  title: string;
  links: BookmarkLink[];
}

const categories: BookmarkCategory[] = [
  {
    title: "Social",
    links: [
      { label: "Twitch", url: "https://Twitch.tv/" },
      { label: "YouTube", url: "https://youtube.com/" },
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Twitter", url: "https://x.com/" },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "FRITZ!Box", url: "http://192.168.178.1/" },
      { label: "FRITZ!Repeater", url: "http://192.168.178.2/" },
      { label: "MyFRITZ!Net", url: "https://www.myfritz.net/devices/#/" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "GitHub", url: "https://github.com/" },
      { label: "iLovePDF", url: "https://www.ilovepdf.com/" },
      { label: "TinyWOW", url: "https://tinywow.com/" },
      { label: "Ninite", url: "https://ninite.com/" },
    ],
  },
  {
    title: "Share",
    links: [
      { label: "Vanish", url: "https://hy.gl/" },
      { label: "Send", url: "https://send.vis.ee/" },
      { label: "Cobalt", url: "https://cobalt.tools" },
    ],
  },
  {
    title: "Shopping",
    links: [
      { label: "Amazon", url: "https://www.amazon.de/" },
      { label: "mydealz", url: "https://www.mydealz.de/" },
      { label: "Slickdeals", url: "https://slickdeals.net/" },
      { label: "MemRadar", url: "https://memradar.com/" },
    ],
  },
  {
    title: "Prices",
    links: [
      { label: "idealo", url: "https://www.idealo.de/" },
      { label: "Geizhals", url: "https://geizhals.de/" },
      { label: "Keepa", url: "https://keepa.com/#!" },
      { label: "Camelcamelcamel", url: "https://de.camelcamelcamel.com/" },
    ],
  },
  {
    title: "Builder",
    links: [
      { label: "PCPartPicker", url: "https://de.pcpartpicker.com/" },
      { label: "PCBuilder", url: "https://pcbuilder.net/" },
      { label: "BuildMyPC", url: "https://buildmypc.net/" },
      { label: "PCCombo", url: "https://www.pc-kombo.com/us/" },
    ],
  },
  {
    title: "Builds",
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
    links: [
      { label: "UserBenchmark", url: "https://www.userbenchmark.com/" },
      { label: "Bottleneck", url: "https://bottleneckcalculator.cc/" },
      { label: "Pangoly", url: "https://pangoly.com/en/" },
    ],
  },
];

const STAGGER_MS = 60;

// Tiles sit in a fixed 3-column grid (nine categories of 3–4 links fill it
// evenly); a partial last row leaves its free cells empty.
// Both layouts are rendered and the inactive one is hidden via the `strips:`
// variant (driven by `data-bookmarks` on <html>), so the saved choice shows
// on first paint without a layout jump after hydration.
export default function Bookmarks() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 auto-rows-fr gap-4 w-full strips:hidden">
        {categories.map((category, i) => (
          <Card
            key={category.title}
            className="animate-stagger-in min-h-[160px] md:min-h-[180px]"
            style={{ animationDelay: `${i * STAGGER_MS}ms` }}
          >
            <div className="text-lg text-paradise-300 mb-1 text-center md:text-left">
              {category.title}
            </div>

            <div className="flex flex-col gap-2 items-center md:items-start">
              {category.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  className="group relative flex items-center justify-center md:justify-start text-sm py-0.5 transition-transform duration-200 transform"
                >
                  <span className="hidden md:block absolute -left-1 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all duration-200 text-paradise-300 animate-page-in">
                    <FaAngleRight className="w-3 h-3" />
                  </span>

                  <span className="transition-colors transition-transform duration-200 transform group-hover:text-paradise-200 md:group-hover:translate-x-3 text-paradise-100/85">
                    {link.label}
                  </span>
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden strips:flex flex-col gap-2 w-full max-w-2xl mx-auto">
        {categories.map((category, i) => (
          <Card
            key={category.title}
            className="animate-stagger-in flex-row! items-center gap-4 px-4 py-2.5"
            style={{ animationDelay: `${i * STAGGER_MS}ms` }}
          >
            <div className="w-20 shrink-0 whitespace-nowrap text-sm text-paradise-300 sm:w-24">
              {category.title}
            </div>

            {/* One line per strip; narrow screens scroll it sideways. w-0 keeps
                the unwrapped links from widening the page itself. */}
            <div className="flex w-0 flex-1 flex-nowrap gap-x-5 overflow-x-auto [scrollbar-width:none]">
              {category.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  className="shrink-0 whitespace-nowrap text-sm py-0.5 text-paradise-100/85 transition-colors duration-200 hover:text-paradise-200 hover:underline decoration-paradise-300/60 underline-offset-4"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

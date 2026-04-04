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
    title: "Daily",
    links: [
      { label: "Twitch", url: "https://Twitch.tv/" },
      { label: "YouTube", url: "https://youtube.com/" },
      { label: "GitHub", url: "https://github.com/" },
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
    title: "Utils",
    links: [
      { label: "Vanish", url: "https://www.vanish.so/" },
      { label: "Cobalt", url: "https://cobalt.tools" },
      { label: "Send", url: "https://send.vis.ee/" },
    ],
  },
  {
    title: "AI",
    links: [
      { label: "Claude", url: "https://claude.ai/" },
      { label: "Gemini", url: "https://gemini.google.com/" },
      { label: "Perplexity", url: "https://www.perplexity.ai/" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "iLovePDF", url: "https://www.ilovepdf.com/" },
      { label: "TinyWOW", url: "https://tinywow.com/" },
      { label: "Ninite", url: "https://ninite.com/" },
    ],
  },
];

const STAGGER_MS = 60;

export default function Bookmarks() {
  return (
    <div className="flex flex-wrap justify-center gap-4 w-full">
      {categories.map((category, i) => (
        <Card
          key={category.title}
          className="animate-stagger-in min-h-[180px] w-[180px]"
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
  );
}

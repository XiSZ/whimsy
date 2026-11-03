import Greeting from "@/components/startpage/Greeting";
import SearchBar from "@/components/startpage/SearchBar";
import Bookmarks from "@/components/startpage/Bookmarks";
import ProgressBars from "@/components/startpage/ProgressBars";
import WeatherWidget from "@/components/startpage/WeatherWidget";
import TwitchWidget from "@/components/startpage/TwitchWidget";
import TodoWidget from "@/components/startpage/TodoWidget";
import CalendarWidget from "@/components/startpage/CalendarWidget";
import SettingsPanel from "@/components/startpage/SettingsPanel";
import { ShowWidget } from "@/components/startpage/settings";
import CurrentTime from "@/components/time/CurrentTime";

export default function Page() {
  return (
    <>
      <ShowWidget name="twitch">
        <TwitchWidget />
      </ShowWidget>
      <ShowWidget name="weather">
        <WeatherWidget />
      </ShowWidget>
      <SettingsPanel />
      {/* Fixed column width so search, bookmarks and progress line up
          regardless of which content happens to be widest. */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 animate-page-in">
        <div className="flex flex-col items-center gap-1 opacity-0 animate-[fadeIn_0.5s_ease-out_0.1s_forwards]">
          <Greeting />
          <div className="flex items-center text-paradise-200 mt-1 gap-2">
            <CurrentTime className="text-xl" />
          </div>
        </div>

        <div className="opacity-0 animate-[fadeIn_0.5s_ease-out_0.25s_forwards] w-full max-w-2xl">
          <SearchBar />
        </div>

        <div className="opacity-0 animate-[fadeIn_0.5s_ease-out_0.4s_forwards] w-full">
          <Bookmarks />
        </div>

        <ShowWidget name="progress">
          <ProgressBars />
        </ShowWidget>
      </div>
      {/* Stacked bottom-right on desktop (so they never overlap); after the
          column on phones. */}
      <div className="flex w-full flex-col gap-4 md:fixed md:bottom-4 md:right-4 md:z-20 md:w-[240px]">
        <ShowWidget name="calendar">
          <CalendarWidget />
        </ShowWidget>
        <ShowWidget name="todo">
          <TodoWidget />
        </ShowWidget>
      </div>
    </>
  );
}

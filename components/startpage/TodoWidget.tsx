"use client";

import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { FaTimes } from "react-icons/fa";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const TODOS_KEY = "whimsy-todos";

function readTodos(): Todo[] {
  try {
    const stored = JSON.parse(localStorage.getItem(TODOS_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export default function TodoWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");

  // Every new tab is another copy of this list; follow edits made in them.
  useEffect(() => {
    setTodos(readTodos());
    const onStorage = (event: StorageEvent) => {
      if (event.key === TODOS_KEY) setTodos(readTodos());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Applies the change to the stored list, not this tab's copy, so a stale
  // tab can't overwrite tasks added elsewhere.
  const save = (change: (list: Todo[]) => Todo[]) => {
    const next = change(readTodos());
    setTodos(next);
    try {
      localStorage.setItem(TODOS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — the change won't persist.
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    save((list) => [...list, { id: Date.now(), text, done: false }]);
    setDraft("");
  };

  return (
    <div className="w-full rounded-xl border border-[#2d2d2d]/70 bg-[#161616]/62 px-3 py-2 backdrop-blur-lg backdrop-saturate-150 opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]">
      <div className="text-[11px] uppercase tracking-wide text-paradise-200/75">
        To-do
      </div>

      {todos.length > 0 && (
        <ul className="twitch-scroll mt-1.5 grid max-h-60 gap-1 overflow-y-auto">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-start gap-2 text-sm">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={(event) =>
                    save((list) =>
                      list.map((item) =>
                        item.id === todo.id
                          ? { ...item, done: event.target.checked }
                          : item,
                      ),
                    )
                  }
                  className="mt-1 shrink-0 cursor-pointer accent-paradise-300"
                />
                <span
                  className={clsx(
                    "min-w-0 break-words",
                    todo.done
                      ? "text-paradise-100/40 line-through"
                      : "text-paradise-100/85",
                  )}
                >
                  {todo.text}
                </span>
              </label>
              <button
                onClick={() =>
                  save((list) => list.filter((item) => item.id !== todo.id))
                }
                title="Delete"
                aria-label={`Delete "${todo.text}"`}
                className="mt-1 shrink-0 cursor-pointer text-[10px] text-paradise-100/30 transition-colors hover:text-paradise-red"
              >
                <FaTimes />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task…"
          aria-label="New task"
          className="mt-1.5 w-full border-b border-[#2d2d2d]/80 bg-transparent py-1 text-sm text-paradise-100 outline-none transition-colors placeholder:text-paradise-100/40 focus:border-paradise-300/60"
        />
      </form>
    </div>
  );
}

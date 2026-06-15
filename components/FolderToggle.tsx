"use client";

/**
 * FolderToggle — switches the "all takes" listing between two server-rendered
 * groupings (by film genre / by critical register). Both groupings are built on
 * the server and passed in as nodes; the default (genre) is in the initial HTML
 * for SEO, register renders on toggle.
 */

import { useState, type ReactNode } from "react";

export default function FolderToggle({
  genre,
  register,
}: {
  genre: ReactNode;
  register: ReactNode;
}) {
  const [by, setBy] = useState<"genre" | "register">("genre");
  return (
    <>
      <div className="mt-fold-tabs" role="tablist" aria-label="Group takes by">
        <button
          type="button"
          role="tab"
          aria-selected={by === "genre"}
          className={by === "genre" ? "on" : ""}
          onClick={() => setBy("genre")}
        >
          By genre
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={by === "register"}
          className={by === "register" ? "on" : ""}
          onClick={() => setBy("register")}
        >
          By register
        </button>
      </div>
      <div>{by === "genre" ? genre : register}</div>
    </>
  );
}

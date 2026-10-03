"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { AuthAudience } from "./auth-entry";

const Aurora = dynamic(() => import("./aurora"), { ssr: false });

export function AuthIllustration({ audience }: { audience: AuthAudience }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(wide.matches && !motion.matches);
    update();
    wide.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);

  return (
    <aside className="relative hidden min-h-dvh overflow-hidden border-l border-border bg-[#153943] text-[#f8fbf7] lg:flex lg:flex-col lg:justify-between" aria-label="About Syndes">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,#286a71_0%,transparent_42%),linear-gradient(150deg,#173f47,#102b36_72%)]" />
      {animate ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] opacity-50">
          <Aurora colorStops={["#2e8c84", "#77a99b", "#2b6b76"]} amplitude={0.6} blend={0.7} />
        </div>
      ) : null}
      <div className="relative z-10 m-10 flex items-center gap-2 text-meta font-semibold tracking-[0.14em] uppercase opacity-80">
        <span className="size-2 rounded-full bg-[#a8d5b4]" /> A quieter way to learn
      </div>
      <div className="relative z-10 max-w-[38rem] px-10 pb-16 xl:px-16 xl:pb-20">
        <p className="mb-5 text-meta font-medium uppercase tracking-[0.18em] text-[#b8d9d0]">
          {audience === "student" ? "A place to begin" : "A place to create"}
        </p>
        <h2 className="max-w-[12ch] text-[clamp(2.75rem,5vw,5rem)] leading-[1.06] font-semibold tracking-[-0.045em]">
          {audience === "student" ? "Make every lesson count." : "Make room for better lessons."}
        </h2>
        <p className="mt-7 max-w-[33rem] text-body leading-relaxed text-[#d9e9e5]">
          {audience === "student"
            ? "Explore your school’s published Modules, carry downloaded lessons with you, and pick up where you left off."
            : "Shape ideas into Modules, keep your Drafts close, and publish when your work is ready for Learners."}
        </p>
        <div className="mt-12 h-px w-full bg-white/20" />
        <p className="mt-5 text-meta text-[#c3dfd8]">
          {audience === "student" ? "Study on this device, even when the connection is away." : "Your Teacher access is checked online before authoring begins."}
        </p>
      </div>
    </aside>
  );
}

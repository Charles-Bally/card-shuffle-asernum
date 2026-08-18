"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { Project } from "@/lib/projects";

export default function ProjectCard({
  project,
  blank,
  lift = false,
}: {
  project: Project;
  blank: boolean;
  lift?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      animate={{ backgroundColor: blank ? "#0c0c0e" : "#141416" }}
      whileHover={
        lift && !reduced
          ? { y: -6, transition: { type: "spring", stiffness: 260, damping: 22 } }
          : undefined
      }
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="card-shell flex h-full flex-col overflow-hidden rounded-[var(--card-r,32px)] border border-white/8 text-white"
    >
      <motion.div
        animate={{ opacity: blank ? 0 : 1 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="flex flex-1 flex-col"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          {reduced ? (
            <Image
              src={project.cover}
              alt={project.name}
              fill
              sizes="(max-width: 768px) 60vw, 340px"
              className="object-cover"
              priority
            />
          ) : (
            <video
              src={project.video}
              poster={project.cover}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/25" />
          <span className="absolute left-4 top-4 rounded-full bg-black/35 px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-white/80 backdrop-blur-md">
            {project.index}
          </span>
          <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/80 backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {project.status}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-accent/90">
            {project.category}
          </p>
          <h2 className="font-display text-[17px] font-medium leading-snug tracking-tight">
            {project.name}
          </h2>
          <p className="text-[12px] leading-relaxed text-white/50">
            {project.description}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-3.5">
            <div className="flex -space-x-2">
              {project.team.map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full border-2 border-[#141416] object-cover"
                />
              ))}
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[14px] font-medium leading-none">
                {project.metric.value}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/40">
                {project.metric.label}
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}

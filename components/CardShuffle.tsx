"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type AnimationSequence,
} from "framer-motion";
import ProjectCard from "@/components/ProjectCard";
import { projects } from "@/lib/projects";

type Role = "left" | "center" | "right";
type Roles = Record<Role, number>;
type Mode = "maquette" | "projets" | "session";

const ROLES: Role[] = ["left", "center", "right"];

// Reproduit la maquette AE : éventail incliné (-7° / 0° / +7°), pas de 1.1 s.
// Les trois cartes sont quasi de même taille (léger retrait à 98 % sur les
// côtés, comme dans la comp) : la hiérarchie ne vient plus de l'échelle mais
// de la lumière — les voiles latéraux se relaient pendant le mouvement.
const STEP = 1;
const HOLD = 0.35;
// un pas = un seul geste : trois mouvements identiques (même courbe,
// même durée, même départ), l'échange de plan se fait à mi-course sous
// le double fondu des bords en regard
const MOVE = 0.52;
const SEQ_DUR = 2 * STEP + HOLD + MOVE;
// creux de la plongée : la carte qui traverse s'enfonce puis remonte
const DIVE_SCALE = 0.87;
const DIVE_Y = 30;
const DIVE_DIM = 0.62;

const SLOTS: Record<Role, { x: number; rot: number; scale: number; z: number; dim: number }> = {
  left: { x: -74, rot: -7, scale: 0.98, z: 2, dim: 0.42 },
  center: { x: 0, rot: 0, scale: 1, z: 3, dim: 0 },
  right: { x: 74, rot: 7, scale: 0.98, z: 1, dim: 0.42 },
};

const FAN: Record<Role, { x: number; y: number; rot: number; scale: number }> = {
  left: { x: -46, y: 16, rot: -7, scale: 1 },
  center: { x: 0, y: -30, rot: 0, scale: 1.03 },
  right: { x: 46, y: 16, rot: 7, scale: 1 },
};

const INIT_ROLES: Roles = { center: 0, right: 1, left: 2 };

const INOUT: [number, number, number, number] = [0.45, 0, 0.55, 1];
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const FOLD: [number, number, number, number] = [0.65, 0, 0.35, 1];
// relais de lumière : une seule courbe par voile, aucune cassure de vitesse —
// l'extinction retient son départ puis se pose, l'allumage part tôt et atterrit
const LATE_IN: [number, number, number, number] = [0.7, 0, 0.35, 1];
const EARLY_OUT: [number, number, number, number] = [0.22, 0.8, 0.36, 1];

const MODES: { value: Mode; label: string }[] = [
  { value: "maquette", label: "Maquette" },
  { value: "projets", label: "Projets" },
  { value: "session", label: "Session" },
];

const rotateRoles = (r: Roles): Roles => ({ center: r.right, left: r.center, right: r.left });

export default function CardShuffle() {
  const [scope, animate] = useAnimate();
  const [mode, setMode] = useState<Mode>("maquette");
  // durée d'un tour affichée ; pilote la vitesse de lecture de la séquence
  const [loopDur, setLoopDur] = useState(3);
  const speedRef = useRef(SEQ_DUR / 3);
  const wrapRefs = useRef<HTMLDivElement[]>([]);
  const innerRefs = useRef<HTMLDivElement[]>([]);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);
  // horloge embarquée dans la séquence : toujours synchrone avec le mouvement
  const clock = useMotionValue(0);
  const baseRolesRef = useRef<Roles>(INIT_ROLES);
  const openRolesRef = useRef<Roles>(INIT_ROLES);
  const openRef = useRef(false);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();

  const zA = useMotionValue(SLOTS.center.z);
  const zB = useMotionValue(SLOTS.right.z);
  const zC = useMotionValue(SLOTS.left.z);
  const zMvs = [zA, zB, zC];

  // voiles et fondus de bords pilotés par MotionValues, jamais en ciblant les
  // éléments : une animation WAAPI pausée par le hover reprendrait sinon la
  // main à la fin du geste d'ouverture et refigerait les cartes en sombre
  const shadeA = useMotionValue(SLOTS.center.dim);
  const shadeB = useMotionValue(SLOTS.right.dim);
  const shadeC = useMotionValue(SLOTS.left.dim);
  const shadeMvs = [shadeA, shadeB, shadeC];
  const fadeLA = useMotionValue(0);
  const fadeLB = useMotionValue(0);
  const fadeLC = useMotionValue(0);
  const fadeRA = useMotionValue(0);
  const fadeRB = useMotionValue(0);
  const fadeRC = useMotionValue(0);
  const fadeLMvs = [fadeLA, fadeLB, fadeLC];
  const fadeRMvs = [fadeRA, fadeRB, fadeRC];
  const maskA = useMotionTemplate`linear-gradient(to right, transparent 0, #000 ${fadeLA}%, #000 calc(100% - ${fadeRA}%), transparent 100%)`;
  const maskB = useMotionTemplate`linear-gradient(to right, transparent 0, #000 ${fadeLB}%, #000 calc(100% - ${fadeRB}%), transparent 100%)`;
  const maskC = useMotionTemplate`linear-gradient(to right, transparent 0, #000 ${fadeLC}%, #000 calc(100% - ${fadeRC}%), transparent 100%)`;
  const masks = [maskA, maskB, maskC];

  // parallaxe : l'éventail déployé suit subtilement le curseur
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const openAmt = useMotionValue(0);
  const tiltY = useSpring(useTransform(() => mx.get() * 5 * openAmt.get()), {
    stiffness: 140,
    damping: 18,
  });
  const tiltX = useSpring(useTransform(() => my.get() * -4 * openAmt.get()), {
    stiffness: 140,
    damping: 18,
  });

  const rolesAt = (local: number): Roles => {
    const k = local < HOLD ? 0 : (Math.floor((local - HOLD) / STEP) + 1) % 3;
    let roles = baseRolesRef.current;
    for (let i = 0; i < k; i++) roles = rotateRoles(roles);
    return roles;
  };

  // plans dérivés du temps de la séquence : entrante 1→4, ex-avant 3, wrap 0,
  // puis normalisation 3/2/1 une fois tout posé — toujours des entiers, jamais
  // de bascule pendant un chevauchement
  const zAt = (local: number): Record<number, number> => {
    const out: Record<number, number> = {};
    if (local < HOLD) {
      ROLES.forEach((role) => { out[baseRolesRef.current[role]] = SLOTS[role].z; });
      return out;
    }
    const step = Math.min(2, Math.floor((local - HOLD) / STEP));
    const phase = local - (step * STEP + HOLD);
    const r = rolesAt(local);
    if (phase < MOVE / 2) {
      out[r.center] = 1; out[r.left] = 3; out[r.right] = 0;
    } else if (phase < MOVE + 0.08) {
      out[r.center] = 4; out[r.left] = 3; out[r.right] = 0;
    } else {
      out[r.center] = 3; out[r.left] = 2; out[r.right] = 1;
    }
    return out;
  };

  const buildAndRun = (base: Roles) => {
    baseRolesRef.current = base;
    const inner = innerRefs.current;
    let roles = base;
    const seq: AnimationSequence = [
      [clock, [0, SEQ_DUR], { at: 0, duration: SEQ_DUR, ease: "linear" }],
    ];

    for (let step = 0; step < 3; step++) {
      const t = step * STEP + HOLD;
      const { center: c, right: r, left: l } = roles;
      const dim = SLOTS.left.dim;

      seq.push(
        // la gauche plonge derrière et traverse, bords en fondu,
        // voile au plus sombre au creux de la plongée
        [
          inner[l],
          { x: [`${SLOTS.left.x}%`, `${SLOTS.right.x}%`], rotate: [SLOTS.left.rot, SLOTS.right.rot] },
          { at: t, duration: MOVE, ease: INOUT },
        ],
        [
          inner[l],
          { y: [0, DIVE_Y, 0], scale: [SLOTS.left.scale, DIVE_SCALE, SLOTS.left.scale] },
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        [
          fadeLMvs[l],
          [0, 18, 0],
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        [
          fadeRMvs[l],
          [0, 18, 0],
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        [
          shadeMvs[l],
          [dim, DIVE_DIM, dim],
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        // la carte avant glisse vers la gauche : elle reste lisible et ne
        // s'éteint qu'en toute fin de course — l'extinction est retenue
        [
          inner[c],
          { x: ["0%", `${SLOTS.left.x}%`], rotate: [0, SLOTS.left.rot], scale: [1, SLOTS.left.scale] },
          { at: t, duration: MOVE, ease: INOUT },
        ],
        [
          fadeRMvs[c],
          [0, 22, 0],
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        [shadeMvs[c], [0, dim], { at: t, duration: MOVE, ease: LATE_IN }],
        // l'entrante se pose par-dessus : elle s'allume dès la mi-course,
        // le regard bascule vers elle avant même qu'elle soit posée
        [
          inner[r],
          { x: [`${SLOTS.right.x}%`, "0%"], rotate: [SLOTS.right.rot, 0], scale: [SLOTS.right.scale, 1] },
          { at: t, duration: MOVE, ease: INOUT },
        ],
        [
          fadeLMvs[r],
          [0, 26, 0],
          { at: t, duration: MOVE, times: [0, 0.5, 1], ease: "easeInOut" },
        ],
        [shadeMvs[r], [dim, 0], { at: t, duration: MOVE, ease: EARLY_OUT }],
      );
      roles = rotateRoles(roles);
    }
    controlsRef.current = animate(seq, { repeat: Infinity });
    controlsRef.current.speed = speedRef.current;
  };

  const setLoopDuration = (secs: number) => {
    setLoopDur(secs);
    speedRef.current = SEQ_DUR / secs;
    if (controlsRef.current) controlsRef.current.speed = speedRef.current;
  };

  useEffect(() => {
    if (reduced) return;
    buildAndRun(INIT_ROLES);

    let raf = 0;
    const drive = () => {
      raf = requestAnimationFrame(drive);
      if (!controlsRef.current || openRef.current || busyRef.current) return;
      const z = zAt(clock.get());
      for (const [card, value] of Object.entries(z)) zMvs[+card].set(value);
    };
    raf = requestAnimationFrame(drive);

    return () => {
      cancelAnimationFrame(raf);
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // le damier AE s'éteint quand la scène devient une vraie page
  useEffect(() => {
    document.body.dataset.mode = mode;
    return () => { delete document.body.dataset.mode; };
  }, [mode]);

  const open = () => {
    if (openRef.current) return;
    openRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    scope.current?.classList.add("is-open");

    const controls = controlsRef.current;
    let roles = openRolesRef.current;
    if (controls) {
      controls.pause();
      roles = rolesAt(clock.get());
      openRolesRef.current = roles;
    }
    const d = reduced ? 0.2 : 1;
    if (!reduced) animate(openAmt, 1, { duration: 0.5, ease: "easeOut" });
    ROLES.forEach((role) => {
      const i = roles[role];
      const s = SLOTS[role];
      animate(
        innerRefs.current[i],
        { x: `${s.x}%`, rotate: s.rot, scale: s.scale, y: 0 },
        { duration: 0.45 * d, ease: EXPO_OUT },
      );
      animate(fadeLMvs[i], 0, { duration: 0.45 * d, ease: "easeOut" });
      animate(fadeRMvs[i], 0, { duration: 0.45 * d, ease: "easeOut" });
      animate(
        wrapRefs.current[i],
        { x: `${FAN[role].x}%`, y: FAN[role].y, rotate: FAN[role].rot, scale: FAN[role].scale },
        reduced
          ? { duration: 0.2 }
          : {
              type: "spring",
              stiffness: 165,
              damping: 21,
              mass: 0.9,
              delay: role === "center" ? 0 : 0.05,
            },
      );
      animate(shadeMvs[i], 0, { duration: 0.45 * d, ease: "easeOut" });
    });
    // les plans ne sont réordonnés qu'une fois les cartes écartées
    timerRef.current = setTimeout(() => {
      if (!openRef.current) return;
      ROLES.forEach((role) => zMvs[roles[role]].set(SLOTS[role].z));
    }, 220 * d);
    // filet : l'éventail ouvert est un état statique — voiles et fondus à zéro,
    // quelle que soit l'animation que la bascule a pu laisser en vol
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = setTimeout(() => {
      if (!openRef.current) return;
      [...shadeMvs, ...fadeLMvs, ...fadeRMvs].forEach((mv) => {
        mv.stop();
        mv.set(0);
      });
    }, 480 * d);
  };

  const close = () => {
    if (!openRef.current) return;
    openRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    scope.current?.classList.remove("is-open");

    busyRef.current = true;
    const roles = openRolesRef.current;
    const d = reduced ? 0.3 : 1;
    animate(openAmt, 0, { duration: 0.35, ease: "easeOut" });
    ROLES.forEach((role) => {
      const i = roles[role];
      const s = SLOTS[role];
      zMvs[i].set(s.z);
      animate(
        wrapRefs.current[i],
        { x: "0%", y: 0, rotate: 0, scale: 1 },
        { duration: 0.55 * d, ease: FOLD },
      );
      animate(
        innerRefs.current[i],
        { x: `${s.x}%`, rotate: s.rot, scale: s.scale, y: 0 },
        { duration: 0.55 * d, ease: FOLD },
      );
      animate(fadeLMvs[i], 0, { duration: 0.55 * d, ease: "easeOut" });
      animate(fadeRMvs[i], 0, { duration: 0.55 * d, ease: "easeOut" });
      animate(shadeMvs[i], s.dim, { duration: 0.55 * d, ease: "easeInOut" });
    });
    // une fois les cartes reposées, la boucle repart du point de repos courant
    if (guardRef.current) clearTimeout(guardRef.current);
    timerRef.current = setTimeout(() => {
      if (openRef.current || reduced) return;
      // même filet qu'à l'ouverture : le repos est un état connu, on le fixe
      ROLES.forEach((role) => {
        const mv = shadeMvs[roles[role]];
        mv.stop();
        mv.set(SLOTS[role].dim);
      });
      [...fadeLMvs, ...fadeRMvs].forEach((mv) => {
        mv.stop();
        mv.set(0);
      });
      controlsRef.current?.stop();
      buildAndRun(roles);
      busyRef.current = false;
    }, 560);
  };

  const session = mode === "session";
  // en maquette les cartes restent des placeholders noirs, même éventail déployé
  const showBlank = mode === "maquette";

  return (
    <main className="ae-canvas flex min-h-dvh flex-col px-6 py-5 sm:px-10">
      <header className="flex items-baseline justify-between">
        <p className="font-display text-[13px] font-medium tracking-tight">
          asernum<span className="text-accent">·</span>lab
        </p>
        <AnimatePresence mode="wait">
          {session ? (
            <motion.nav
              key="nav-page"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              aria-label="Navigation principale"
              className="flex items-baseline gap-7 font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
            >
              <a href="#travaux" className="transition-colors duration-300 hover:text-ink">
                Travaux
              </a>
              <a href="#" className="transition-colors duration-300 hover:text-ink">
                Studio
              </a>
              <a href="#" className="transition-colors duration-300 hover:text-ink">
                Contact
              </a>
            </motion.nav>
          ) : (
            <motion.div
              key="nav-lab"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted"
            >
              <label className="flex cursor-ew-resize items-center gap-3">
                <span>Boucle</span>
                <input
                  type="range"
                  min={1.5}
                  max={8}
                  step={0.1}
                  value={loopDur}
                  onChange={(e) => setLoopDuration(Number(e.target.value))}
                  aria-label="Durée d'un tour de boucle, en secondes"
                  className="loop-range"
                />
                <span className="w-[5ch] whitespace-nowrap text-right tabular-nums text-ink/80">
                  {loopDur.toFixed(1).replace(".", ",")}&nbsp;s
                </span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* section 1 — le hero n'existe qu'en session : la page se déplie
          au-dessus de la scène sans jamais toucher à la boucle */}
      <AnimatePresence>
        {session && (
          <motion.section
            key="hero"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.7, ease: EXPO_OUT }}
            className="overflow-hidden"
          >
            <div className="mx-auto max-w-[720px] pt-14 text-center sm:pt-20">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
                Studio produit · Afrique de l&apos;Ouest
              </p>
              <h1 className="mt-4 font-display text-[clamp(26px,4vw,44px)] font-medium leading-[1.15] tracking-tight">
                Des produits financiers dessinés avec soin.
              </h1>
              <p className="mx-auto mt-4 max-w-[440px] text-[13px] leading-relaxed text-muted">
                Paiements, portefeuilles, trésorerie — trois systèmes en
                production, du concept au code.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* section 2 — la scène : la boucle ne s'arrête jamais, quel que soit le mode */}
      <section id="travaux" className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
        <AnimatePresence>
          {session && (
            <motion.div
              key="travaux-label"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: EXPO_OUT }}
              className="w-full overflow-hidden"
            >
              <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink/80">
                  Travaux
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  03 projets · 2026
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={scope}
          role="group"
          aria-label="Projets en rotation — survoler pour figer et déployer"
          tabIndex={0}
          className="stage relative flex h-[min(58vh,520px)] w-full items-center justify-center outline-none"
          onPointerEnter={(e) => e.pointerType === "mouse" && open()}
          onPointerLeave={(e) => e.pointerType === "mouse" && close()}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
            my.set(((e.clientY - r.top) / r.height) * 2 - 1);
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== "mouse") (openRef.current ? close : open)();
          }}
          onFocus={open}
          onBlur={close}
        >
          <div className="grid place-items-center" style={{ perspective: 1100 }}>
            {projects.map((project, i) => {
              const role = ROLES.find((r) => INIT_ROLES[r] === i)!;
              const s = SLOTS[role];
              return (
                <motion.div
                  key={project.id}
                  ref={(el) => { if (el) wrapRefs.current[i] = el; }}
                  style={{ zIndex: zMvs[i], rotateX: tiltX, rotateY: tiltY }}
                  className="col-start-1 row-start-1 w-[var(--card-w)] will-change-transform"
                >
                  <motion.div
                    ref={(el) => { if (el) innerRefs.current[i] = el; }}
                    style={{
                      x: `${s.x}%`,
                      rotate: s.rot,
                      scale: s.scale,
                      WebkitMaskImage: masks[i],
                      maskImage: masks[i],
                    }}
                    className="card-inner relative will-change-transform"
                  >
                    <ProjectCard project={project} blank={showBlank} />
                    <motion.div
                      style={{ opacity: shadeMvs[i] }}
                      className="pointer-events-none absolute inset-0 rounded-[var(--card-r,32px)] bg-black"
                    />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="flex h-5 items-center">
          <AnimatePresence mode="wait">
            {!session && (
              <motion.p
                key="hint"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.08em] text-muted"
              >
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                Survoler la scène pour figer la boucle et déployer les projets
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {session ? (
          <motion.footer
            key="footer-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mt-8"
          >
            <div className="flex flex-col gap-8 border-t border-white/10 pt-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-[13px] font-medium tracking-tight">
                  asernum<span className="text-accent">·</span>lab
                </p>
                <p className="mt-2.5 max-w-[280px] text-[11.5px] leading-relaxed text-muted">
                  Studio produit — systèmes de paiement et outils financiers
                  pour l&apos;Afrique de l&apos;Ouest.
                </p>
              </div>
              <div className="flex gap-14">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                    Travaux
                  </p>
                  <ul className="mt-3 space-y-2 text-[11.5px] text-ink/80">
                    {projects.map((p) => (
                      <li key={p.id}>
                        <a href="#travaux" className="transition-colors duration-300 hover:text-accent">
                          {p.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                    Studio
                  </p>
                  <ul className="mt-3 space-y-2 text-[11.5px] text-ink/80">
                    {["À propos", "Équipe", "Contact"].map((label) => (
                      <li key={label}>
                        <a href="#" className="transition-colors duration-300 hover:text-accent">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-8 flex items-baseline justify-between border-t border-white/8 pb-14 pt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              <p>© 2026 Asernum Lab</p>
              <p>Abidjan · Dakar</p>
            </div>
          </motion.footer>
        ) : (
          <motion.footer
            key="footer-lab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-baseline justify-end"
          >
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted">
              Framer Motion · Next.js
            </p>
          </motion.footer>
        )}
      </AnimatePresence>

      {/* le sélecteur de mode flotte au-dessus de la page : toujours accessible */}
      <div
        role="group"
        aria-label="Mode d'affichage de la scène"
        className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center rounded-full border border-white/10 bg-black/45 p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className="relative rounded-full px-5 py-1.5 font-mono text-[11px] tracking-[0.08em] outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {mode === option.value && (
              <motion.span
                layoutId="mode-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span
              className={`relative z-10 transition-colors duration-300 ${
                mode === option.value ? "text-[#131315]" : "text-muted"
              }`}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

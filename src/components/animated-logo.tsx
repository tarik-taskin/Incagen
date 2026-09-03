import { useEffect, useId, useRef } from "react";
import { animate, stagger, svg } from "animejs";
import { cn } from "../lib/utils";

type AnimatedLogoProps = { className?: string; compact?: boolean };

export function AnimatedLogo({ className, compact = false }: AnimatedLogoProps) {
  const logoRef = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const root = logoRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const shell = root.querySelector("[data-logo-shell]");
    const network = root.querySelector("[data-network]");
    const nodes = root.querySelectorAll("[data-node]");
    const signal = root.querySelector("[data-signal]");
    const signalPath = root.querySelector<SVGPathElement>("[data-signal-path]");

    if (!shell || !network) return;

    const shellIntro = animate(shell, { opacity: [0, 1], scale: [0.9, 1], duration: 900, ease: "outExpo" });
    const networkIntro = animate(network, { opacity: [0, 1], scale: [0.82, 1], duration: 1100, delay: 180, ease: "outElastic(1, .65)" });
    const nodePulse = animate(nodes, {
      scale: [0.84, 1.1],
      opacity: [0.7, 1],
      duration: 1350,
      delay: stagger(170),
      ease: "inOutSine",
      alternate: true,
      loop: true,
    });
    const signalFlow = signal && signalPath
      ? animate(signal, {
          ...svg.createMotionPath(signalPath),
          opacity: [{ to: 1, duration: 240 }, { to: 1, duration: 1250 }, { to: 0, duration: 260 }],
          duration: 2200,
          delay: 900,
          ease: "inOutSine",
          loop: true,
          loopDelay: 700,
        })
      : null;

    return () => {
      shellIntro.cancel();
      networkIntro.cancel();
      nodePulse.cancel();
      signalFlow?.cancel();
    };
  }, []);

  return (
    <svg ref={logoRef} viewBox="42 387 238 250" role="img" aria-label="Incagen logosu" className={cn("overflow-visible drop-shadow-[0_12px_28px_rgba(76,42,133,0.18)]", className)}>
      <defs>
        <linearGradient id={gradientId} x1="75" y1="594" x2="245" y2="418" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BCEDF6" />
          <stop offset="1" stopColor="#DDFBD2" />
        </linearGradient>
        <filter id={`${gradientId}-glow`} x="-250%" y="-250%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path data-logo-shell className="logo-part" fill="#4C2A85" d="M207.939 404.125C234.995 401.841 256.991 418.307 261.88 445.156C264.468 460.161 260.892 475.575 251.961 487.907C247.208 494.61 240.257 500.771 234.497 506.824L191.687 550.94L159.464 584.48C143.273 601.594 134.593 614.634 110.208 618.868C71.4266 625.455 46.8812 584.493 59.6482 550.583C65.8175 534.198 79.4847 522.873 91.4249 510.474L138.327 461.795L164.436 434.257C178.821 419.083 186.905 409.018 207.939 404.125Z" />
      <path data-network className="logo-part" fill={`url(#${gradientId})`} d="M209.273 431.633L209.792 431.594C233.809 429.984 246.957 455.901 233.98 475.243C228.128 483.964 217.62 487.778 207.508 487.268C201.192 486.95 195.398 489.222 190.577 493.297C173.841 507.162 188.087 523.765 172.346 539.615C156.787 555.282 145.427 542.759 129.116 551.656C117.721 557.871 122.274 572.183 113.861 580.946C91.8543 596.331 77.556 558.038 103.054 554.139C108.615 553.649 117.01 553.241 120.68 548.167C132.25 532.171 116.381 520.417 128.436 502.968C133.601 495.363 142.088 490.683 151.276 490.371C162.197 489.947 170.249 491.154 178.957 482.637C191.083 470.777 180.859 455.089 190.662 442.176C195.617 435.649 201.474 432.929 209.273 431.633Z" />
      <path data-signal-path d="M103 569C124 557 119 523 151 519C181 515 177 468 212 459" fill="none" stroke="none" />
      {!compact && <circle data-signal cx="0" cy="0" r="4.5" fill="#FFFFFF" opacity="0" filter={`url(#${gradientId}-glow)`} />}
      <path data-node className="logo-part" fill="#4C2A85" d="M148.115 507.168C154.818 504.903 162.081 508.538 164.285 515.261C166.489 521.984 162.789 529.214 156.046 531.357C149.389 533.474 142.271 529.83 140.095 523.192C137.918 516.555 141.498 509.404 148.115 507.168Z" />
      <path data-node className="logo-part" fill="#4C2A85" d="M211.944 451.291C216.207 451.091 219.829 454.374 220.049 458.635C220.269 462.897 217.003 466.535 212.743 466.775C208.454 467.017 204.786 463.725 204.564 459.434C204.343 455.144 207.653 451.492 211.944 451.291Z" />
      <path data-node className="logo-part" fill="#4C2A85" d="M102.582 561.561C109.08 561.215 112.223 563.428 111.383 571.23C111.135 573.528 108.349 575.265 106.477 576.38C105.583 576.37 104.869 576.41 103.987 576.243C101.788 575.843 99.8488 574.561 98.619 572.694C95.4016 567.704 98.4582 564.183 102.582 561.561Z" />
    </svg>
  );
}

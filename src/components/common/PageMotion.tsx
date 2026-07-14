import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/** Smooth page-content enter animation on route changes. */
export function PageMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      gsap.set(el, { clearProps: "all", opacity: 1, y: 0, filter: "none" });
      gsap.set(el.querySelectorAll("[data-reveal]"), { clearProps: "all", opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: "power4.out",
          clearProps: "transform",
        },
      );

      const reveals = el.querySelectorAll("[data-reveal]");
      if (reveals.length) {
        gsap.fromTo(
          reveals,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.045,
            delay: 0.06,
            ease: "power3.out",
            clearProps: "transform",
          },
        );
      }
    }, el);

    return () => ctx.revert();
  }, [pathname]);

  return (
    <div ref={ref} className="will-change-[transform,opacity]">
      {children}
    </div>
  );
}

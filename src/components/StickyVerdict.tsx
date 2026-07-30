import { useEffect, useState, type RefObject } from "react";
import type { ProductIdentity } from "../../shared/analysis";
import { VERDICT } from "../../shared/format";
import type { Score } from "../../shared/scoring";
import { VERDICT_TONE } from "./verdict";

interface Props {
  /** The hero block; the bar appears once it scrolls out of view. */
  watch: RefObject<HTMLElement | null>;
  product: ProductIdentity;
  score: Score;
}

/**
 * Keeps the recommendation on screen through a long report.
 *
 * The answer must stay a glance away no matter how far the reader has
 * scrolled, and the bar doubles as the way back to the full verdict.
 */
export function StickyVerdict({ watch, product, score }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = watch.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [watch]);

  const verdict = VERDICT[score.verdict];
  const tone = VERDICT_TONE[score.verdict];

  return (
    <button
      type="button"
      // Duplicates the hero, so it stays out of the reading order until it is
      // both visible and useful as a way back.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed inset-x-0 top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <span className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2.5 text-left">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.model}</span>

        <span className={`shrink-0 text-sm font-medium ${tone.text}`}>
          <span aria-hidden="true">{verdict.icon}</span>
          <span className="ml-1.5 hidden sm:inline">{verdict.label}</span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-sm">
          <span className="text-subtle">Riziko</span>
          <span className="font-semibold" style={{ color: tone.stroke }}>
            {score.ownershipRisk}
          </span>
        </span>

        <span aria-hidden="true" className="shrink-0 text-subtle">
          ↑
        </span>
      </span>
    </button>
  );
}

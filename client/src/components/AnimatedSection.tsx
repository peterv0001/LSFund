import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Scroll-triggered fade/slide-in wrapper used across the public marketing
 * section pages. Animation-heavy (framer-motion) — only import this on the
 * focused section pages, never on the lightweight home route.
 */
export function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 };
  const shown = { opacity: 1, y: 0 };
  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={isInView ? shown : hidden}
      transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Accordion FAQ row used on the public section pages. */
export function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const slug = question.slice(0, 20).replace(/\s/g, "-").toLowerCase();
  const panelId = `faq-panel-${slug}`;
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`faq-${slug}`}
      >
        <span className="text-base font-semibold text-foreground pr-4 group-hover:text-primary transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <motion.div
        id={panelId}
        role="region"
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <p className="pb-5 text-muted-foreground leading-relaxed">{answer}</p>
      </motion.div>
    </div>
  );
}

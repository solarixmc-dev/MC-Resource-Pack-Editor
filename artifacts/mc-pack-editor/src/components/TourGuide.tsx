import { useState, useEffect, useRef } from "react";

interface TourStep {
  target: string; // CSS selector for the target element
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

interface TourGuideProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
  darkMode: boolean;
}

export default function TourGuide({ steps, onComplete, onSkip, darkMode }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  useEffect(() => {
    const updatePosition = () => {
      const targetElement = document.querySelector(step.target);
      if (!targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      const popover = popoverRef.current;
      if (!popover) return;

      const popoverRect = popover.getBoundingClientRect();

      let top = rect.top;
      let left = rect.left;

      switch (step.position) {
        case "top":
          top = rect.top - popoverRect.height - 10;
          left = rect.left + (rect.width - popoverRect.width) / 2;
          break;
        case "bottom":
          top = rect.bottom + 10;
          left = rect.left + (rect.width - popoverRect.width) / 2;
          break;
        case "left":
          top = rect.top + (rect.height - popoverRect.height) / 2;
          left = rect.left - popoverRect.width - 10;
          break;
        case "right":
          top = rect.top + (rect.height - popoverRect.height) / 2;
          left = rect.right + 10;
          break;
      }

      // Keep popover within viewport
      const padding = 20;
      top = Math.max(padding, Math.min(top, window.innerHeight - popoverRect.height - padding));
      left = Math.max(padding, Math.min(left, window.innerWidth - popoverRect.width - padding));

      setPosition({ top, left });
      setIsVisible(true);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [step]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Dimmed background */}
      <div className="fixed inset-0 bg-black/60 z-[100] pointer-events-none" />

      {/* Spotlight effect around target */}
      <div
        className="fixed z-[101] pointer-events-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6)`,
          borderRadius: "12px",
          border: "2px solid #C2B280",
        }}
      />

      {/* Tour popover */}
      <div
        ref={popoverRef}
        className={`fixed z-[102] w-80 rounded-xl shadow-2xl border p-6 ${
          darkMode
            ? "bg-dark-secondary border-dark-border text-dark-text"
            : "bg-white border-gray-200 text-gray-900"
        }`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <p className="text-sm mb-4 opacity-80">{step.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-dark-tertiary hover:bg-gray-200 dark:hover:bg-dark-border"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {currentStep === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {currentStep + 1} / {steps.length}
          </span>
        </div>
      </div>
    </>
  );
}
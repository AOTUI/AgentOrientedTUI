import React, { useRef, useState } from "react";
import { cn } from "../../lib/utils.js";

export const MagicCard = ({
  children,
  className,
  gradientColor = "rgba(255, 255, 255, 0.2)",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  gradientColor?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setOpacity(1);
  };

  const handleBlur = () => {
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative flex h-full w-full items-center justify-center rounded-xl bg-transparent",
        className
      )}
      {...props}
    >
      {/* Border Spotlight - The glowing border */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 40%)`,
        }}
      />
      
      {/* Base Border - Subtle visible border when not hovering */}
      <div className="absolute inset-0 rounded-xl border border-white/[0.08]" />

      {/* Inner Content - Sits on top to mask the center of the gradient */}
      <div className="relative h-full w-full rounded-xl bg-[var(--color-bg-surface)] px-6 py-5">
        {children}
      </div>
    </div>
  );
};

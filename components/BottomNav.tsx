"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Dumbbell, BarChart3, Scale, Sparkles } from "lucide-react";

const LEFT = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workout", label: "Train", icon: Dumbbell },
];
const RIGHT = [
  { href: "/progress", label: "Stats", icon: BarChart3 },
  { href: "/body", label: "Body", icon: Scale },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide on immersive/deep screens.
  const hide =
    (pathname.startsWith("/workout/") && pathname !== "/workout") ||
    pathname.startsWith("/workout/templates/") ||
    pathname === "/coach";
  if (hide) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const Tab = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors"
      >
        <Icon className={cn("w-[22px] h-[22px]", active ? "text-[#C7F23E]" : "text-[#5A5F66]")} />
        <span
          className={cn(
            "text-[10px] font-semibold tracking-wide",
            active ? "text-[#F2F4F3]" : "text-[#5A5F66]"
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#08090A]/92 backdrop-blur-xl border-t border-[#1A1C20] safe-bottom">
      <div className="max-w-lg mx-auto flex items-stretch h-[60px] px-2">
        {LEFT.map((t) => (
          <Tab key={t.href} {...t} />
        ))}

        {/* Center: Coach — the signature action */}
        <div className="flex-1 flex items-start justify-center">
          <Link
            href="/coach"
            aria-label="AI Coach"
            className="-mt-5 grid place-items-center h-14 w-14 rounded-full bg-[#C7F23E] text-[#08090A] glow-accent active:scale-95 transition-transform"
          >
            <Sparkles className="w-6 h-6" />
          </Link>
        </div>

        {RIGHT.map((t) => (
          <Tab key={t.href} {...t} />
        ))}
      </div>
    </nav>
  );
}

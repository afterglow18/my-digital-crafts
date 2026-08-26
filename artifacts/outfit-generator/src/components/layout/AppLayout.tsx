import React from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Bookmark, Settings } from "lucide-react";

function YarnIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9c2.5 0 5 1.5 6 4s3.5 4 6.5 3.5" />
      <path d="M3.5 15c2-.5 4-2 5-4.5S12 5.5 15 3.5" />
      <path d="M14 20.5c.5-2.5-.5-5.5-2.5-7.5S6 9 5.5 6" />
    </svg>
  );
}
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "@/hooks/useLocalDB";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: stats } = useGetWardrobeStats();

  const wardrobeCount = stats?.byCategory
    ? stats.byCategory
        .filter((c: { category: string }) =>
          ["outfits", "beauty", "toiletries", "essentials"].includes(c.category)
        )
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    : undefined;

  const navItems = [
    { href: "/",         label: "Crafts",   icon: YarnIcon, badge: wardrobeCount },
    { href: "/generate", label: "Generate", icon: Sparkles  },
    { href: "/saved",    label: "Saved",    icon: Bookmark  },
    { href: "/account",  label: "Settings", icon: Settings  },
  ];

  return (
    // The app is designed for iPhone; the desktop preview keeps a centered
    // phone frame so the same layout is easy to inspect in a browser.
    <div className="min-h-[100dvh] w-full bg-background lg:bg-[#f8f9fa] flex justify-center lg:py-8 lg:px-4">
      {/* Full-width on iPhone; phone frame only in the desktop preview */}
      <div className="w-full lg:max-w-md bg-background h-[100dvh] lg:min-h-[850px] lg:h-[850px] lg:border-[6px] lg:border-black lg:rounded-[3rem] lg:shadow-2xl relative overflow-hidden flex flex-col">

        {/* Terracotta status-bar strip — covers the top safe area on iPhone */}
        <div
          className="absolute top-0 left-0 right-0 z-[50] pointer-events-none"
          style={{ height: "env(safe-area-inset-top)", background: "#8C4F48" }}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}>
          {children}
        </main>

        {/* Bottom Navigation — centred & capped on wide screens so items don't spread */}
        <nav
          className="absolute bottom-0 left-0 right-0 border-t-[3px] border-black z-[40]"
          style={{ background: "#F5F0E8", padding: "0.75rem 0.75rem calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <ul className="flex items-center justify-around md:max-w-sm md:mx-auto lg:max-w-none">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href} className="relative">
                  <Link href={item.href} className="flex flex-col items-center gap-1 group">
                    <div
                      className={cn(
                        "p-2.5 rounded-full border-2 transition-all duration-200 ease-spring relative",
                        isActive
                          ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                          : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-6 h-6",
                          isActive ? "text-black" : "text-muted-foreground",
                          item.href === "/generate" && isActive ? "animate-pulse" : ""
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {/* Badge */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="absolute -top-2 -right-2 bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {item.badge > 99 ? "99+" : item.badge}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider transition-colors",
                        isActive ? "text-black" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

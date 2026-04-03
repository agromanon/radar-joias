import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { RadarCopilot } from "@/components/layout/RadarCopilot";
import { WatchlistProvider } from "@/contexts/WatchlistContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <WatchlistProvider>
        <div className="flex h-screen w-full overflow-hidden bg-[#0B0E14]">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-y-auto relative min-w-0">
            <Header />
            <div className="flex-1 w-full relative">
              {children}
            </div>
            {/* Radar Copilot for High-Value Users */}
            <RadarCopilot />
          </main>
        </div>
      </WatchlistProvider>
    </SidebarProvider>
  );
}

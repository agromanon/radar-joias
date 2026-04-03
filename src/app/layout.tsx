	import type { Metadata } from "next";
	import { Inter, Geist } from "next/font/google";
	import "./globals.css";
	import { ToastProvider } from "@/components/ui/Toast";
	import { TooltipProvider } from "@/components/ui/tooltip";

	const inter = Inter({
	  variable: "--font-inter",
	  subsets: ["latin"],
	  display: "swap",
	});

	export const metadata: Metadata = {
	  title: "Radar Leilão | Oportunidades Industriais",
	  description: "O maior agregador de leilões com inteligência artificial.",
	  manifest: "/manifest.json",
	};

	import { AuthProvider } from "@/hooks/useUser";
	import { cn } from "@/lib/utils";

	const geist = Geist({subsets:['latin'],variable:'--font-sans'});


	export default function RootLayout({
	  children,
	}: Readonly<{
	  children: React.ReactNode;
	}>) {
	  return (
	    <html lang="pt-BR" className={cn("antialiased", inter.variable, "font-sans", geist.variable)}>
	      <body className="min-h-screen bg-[#0B0E14] text-white">
	        <TooltipProvider>
	          <AuthProvider>
	            <ToastProvider>
	              {children}
	            </ToastProvider>
	          </AuthProvider>
	        </TooltipProvider>
	      </body>
	    </html>
	  );
	}

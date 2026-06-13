import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/elip/AppShell";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ELIP — Etihad Lead Intelligence Platform" },
      { name: "description", content: "Bank Al Etihad's AI-powered lead management platform." },
      { property: "og:title", content: "ELIP — Etihad Lead Intelligence Platform" },
      { name: "twitter:title", content: "ELIP — Etihad Lead Intelligence Platform" },
      { property: "og:description", content: "Bank Al Etihad's AI-powered lead management platform." },
      { name: "twitter:description", content: "Bank Al Etihad's AI-powered lead management platform." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ed8601b3-2e23-4bc1-ba25-5b0c37ea164c/id-preview-730811b0--9796db2b-2f6a-4606-bca9-f91b618447ab.lovable.app-1781377386763.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ed8601b3-2e23-4bc1-ba25-5b0c37ea164c/id-preview-730811b0--9796db2b-2f6a-4606-bca9-f91b618447ab.lovable.app-1781377386763.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex h-screen items-center justify-center text-muted-foreground">Page not found</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-red-700">Error: {error.message}</div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

// Used implicitly by AppShell's <Outlet />
export const _outlet = Outlet;

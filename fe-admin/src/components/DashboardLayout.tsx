"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import AccessDenied from "./auth/AccessDenied";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { canAccessPath } from "../lib/auth/permissions";
import { useAuth } from "../lib/auth/provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, session } = useAuth();

  React.useEffect(() => {
    if (pathname !== "/login" && ready && !session.authenticated) {
      router.replace("/login");
    }
  }, [pathname, ready, session.authenticated, router]);

  if (pathname === "/login") {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  // const allowed = canAccessPath(session, pathname);

  return (
    <div className="flex h-screen bg-[#FFFFFF] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto w-full bg-[#FFFFFF]">
        <Header />
        <main className="px-8 pb-12 w-full flex flex-col gap-6 max-w-[1400px] h-full">
          {children}
          {/* {!ready ? (
            <div className="text-[14px] text-gray-500">Loading access profile...</div>
          ) : !session.authenticated ? (
            <div className="text-[14px] text-gray-500">Redirecting to login...</div>
          ) : allowed ? (
            children
          ) : (
            <AccessDenied
              title="Access denied"
              detail="Your role does not have permission to view this section. Switch to a permitted profile or ask a super admin."
            />
          )} */}
        </main>
      </div>
    </div>
  );
}

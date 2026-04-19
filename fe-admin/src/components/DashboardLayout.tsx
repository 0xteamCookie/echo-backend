"use client";
import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#FFFFFF] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto w-full bg-[#FFFFFF]">
        <Header />
        <main className="px-8 pb-12 w-full flex flex-col gap-6 max-w-[1400px] h-full">
          {children}
        </main>
      </div>
    </div>
  );
}

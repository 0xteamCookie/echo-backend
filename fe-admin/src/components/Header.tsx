"use client";
import React from "react";
import { Search, Plus, Settings, Menu } from "lucide-react";
import { useAuth } from "../lib/auth/provider";

export default function Header() {
  const { session, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white sticky top-0 z-10 w-full mb-6">
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder='Try searching "Insights"' 
            className="w-full bg-[#f6f6f6] border-none rounded-full py-2.5 pl-12 pr-4 focus:ring-2 focus:ring-black outline-none transition-all text-[14px]"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-[12px] bg-[#F7F7F7] px-3 py-1.5 rounded-full">
          <span className="text-gray-500">Signed in</span>
          <span className="font-semibold">{session.email || "Unknown"}</span>
          <span className="text-gray-400">|</span>
          <span className="font-semibold uppercase">{session.role}</span>
          <button
            type="button"
            onClick={logout}
            className="ml-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
        <button className="flex items-center justify-center bg-[#E63946] text-white w-9 h-9 rounded-full shadow-sm">
          <Plus size={18} />
        </button>
        <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-black transition-colors rounded-full">
          <Settings size={20} />
        </button>
        
        <div className="flex flex-row gap-0 ml-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs ring-2 ring-white">DJ</div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-600 font-bold text-xs -ml-2 ring-2 ring-white">AL</div>
        </div>
        <button className="w-10 h-10 ml-2 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-100">
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}


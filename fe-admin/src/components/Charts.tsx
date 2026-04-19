"use client";

import React from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from "recharts";

const data = [
  { name: "Medical", val: 5600 },
  { name: "Fire", val: 2300 },
  { name: "Rescue", val: 3400 },
  { name: "Police", val: 1900 },
  { name: "Broadcast", val: 890 },
];

const COLORS = ["#000000", "#E63946", "#Cdd2d5", "#A8DADC", "#457B9D"];

export function EventBarChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#FAFAFA" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
        <Bar dataKey="val" fill="#E63946" radius={[6, 6, 6, 6]} barSize={32}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index === 1 ? "#E63946" : "#E5E7EB"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const lineData = [
  { time: "00", active: 10, res: 5 },
  { time: "04", active: 25, res: 10 },
  { time: "08", active: 65, res: 30 },
  { time: "12", active: 40, res: 50 },
  { time: "16", active: 85, res: 40 },
  { time: "20", active: 30, res: 70 },
  { time: "24", active: 15, res: 85 },
];

export function IncidentTrendChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={lineData} margin={{ top: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EBEBEB" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
        <Line 
          type="monotone" 
          dataKey="active" 
          stroke="#E63946" 
          strokeWidth={3}
          dot={false}
        />
        <Line 
          type="monotone" 
          dataKey="res" 
          stroke="#101010" 
          strokeWidth={3}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

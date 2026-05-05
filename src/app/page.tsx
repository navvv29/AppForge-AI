"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Briefcase, BarChart } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (company) params.set('company', company);
    if (role) params.set('role', role);
    if (level) params.set('level', level);
    
    router.push(`/salaries?${params.toString()}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-semibold mb-6">
        <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
        Levels {'>'} Titles
      </div>
      
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6 max-w-4xl">
        Standardized Compensation <br className="hidden md:block"/> Intelligence.
      </h1>
      
      <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl">
        Stop guessing based on job titles. Discover true market value anchored to standardized engineering levels across top tech companies.
      </p>

      <form onSubmit={handleSearch} className="w-full max-w-4xl bg-white dark:bg-zinc-900 shadow-xl dark:shadow-2xl dark:shadow-blue-900/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 border border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 flex items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          <Search className="h-5 w-5 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search company (e.g., Google)" 
            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 px-3 text-zinc-900 dark:text-white placeholder:text-zinc-500"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4 md:w-auto">
          <div className="flex-1 md:w-40 flex items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 border border-zinc-200 dark:border-zinc-700">
            <Briefcase className="h-4 w-4 text-zinc-400" />
            <select 
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 py-3 px-2 text-zinc-900 dark:text-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="" className="dark:bg-zinc-800">All Roles</option>
              <option value="SDE" className="dark:bg-zinc-800">Software Engineer</option>
              <option value="PM" className="dark:bg-zinc-800">Product Manager</option>
              <option value="Data Scientist" className="dark:bg-zinc-800">Data Scientist</option>
            </select>
          </div>

          <div className="flex-1 md:w-32 flex items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 border border-zinc-200 dark:border-zinc-700">
            <BarChart className="h-4 w-4 text-zinc-400" />
            <select 
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 py-3 px-2 text-zinc-900 dark:text-white"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="" className="dark:bg-zinc-800">All Levels</option>
              <option value="L3" className="dark:bg-zinc-800">L3 (Entry)</option>
              <option value="L4" className="dark:bg-zinc-800">L4 (Mid)</option>
              <option value="L5" className="dark:bg-zinc-800">L5 (Senior)</option>
              <option value="L6" className="dark:bg-zinc-800">L6 (Staff)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-md shadow-blue-500/20">
          Search
        </button>
      </form>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <Link href="/salaries" className="group p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md text-left">
          <div className="bg-blue-50 dark:bg-blue-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Browse Salaries</h3>
          <p className="text-zinc-600 dark:text-zinc-400">Explore comprehensive compensation data filterable by role, level, and location.</p>
        </Link>
        
        <Link href="/company/google" className="group p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all shadow-sm hover:shadow-md text-left">
          <div className="bg-purple-50 dark:bg-purple-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Company Insights</h3>
          <p className="text-zinc-600 dark:text-zinc-400">View detailed company profiles, median compensation, and level distributions. (e.g. Google)</p>
        </Link>

        <Link href="/compare" className="group p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md text-left">
          <div className="bg-green-50 dark:bg-green-900/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
            <BarChart className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-2">Compare Offers</h3>
          <p className="text-zinc-600 dark:text-zinc-400">Evaluate two compensation packages side-by-side to make informed decisions.</p>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const [companySlug, setCompanySlug] = useState('');

  const handleCompanySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (companySlug.trim()) {
      router.push(`/company/${encodeURIComponent(companySlug.trim().toLowerCase())}`);
      setCompanySlug('');
    }
  };

  return (
    <nav className="border-b bg-white dark:bg-zinc-950 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold tracking-tighter text-blue-600 dark:text-blue-400">
              CompIntel
            </Link>
            <div className="hidden md:flex space-x-6">
              <Link href="/salaries" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
                Salaries
              </Link>
              <Link href="/compare" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
                Compare
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <form onSubmit={handleCompanySearch} className="relative hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Company Insights..."
                className="pl-9 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={companySlug}
                onChange={(e) => setCompanySlug(e.target.value)}
              />
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

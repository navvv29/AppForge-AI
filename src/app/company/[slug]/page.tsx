"use client";

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Building2, ArrowLeft, TrendingUp } from 'lucide-react';

interface Salary {
  id: string;
  role: string;
  level: string;
  location: string;
  experience_years: number;
  total_compensation: number;
  base_salary: number;
  bonus: number;
  stock: number;
}

interface CompanyData {
  salaries: Salary[];
  median_compensation: number;
  level_distribution: Record<string, number>;
}

export default function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = use(params);
  const slug = unwrappedParams.slug;
  
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await fetch(`/api/company/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          setError('Company not found');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Error loading company data');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [slug]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col gap-8 animate-pulse">
        <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
          <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
        </div>
        <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Building2 className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{error || "Not found"}</h1>
        <p className="text-zinc-500 mb-6">We don't have enough data for this company yet.</p>
        <Link href="/salaries" className="flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to all salaries
        </Link>
      </div>
    );
  }

  // Calculate max count for level distribution bars
  const maxLevelCount = Math.max(...Object.values(data.level_distribution));
  // Sort levels
  const sortedLevels = Object.entries(data.level_distribution).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Link href="/salaries" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-4xl font-extrabold capitalize">{decodeURIComponent(slug)}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-blue-100 font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" /> Median Total Compensation
            </h2>
            <p className="text-sm text-blue-200">Across all roles and levels</p>
          </div>
          <div className="text-5xl font-black tracking-tight mt-6">
            {formatCurrency(data.median_compensation)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Level Distribution</h2>
          <div className="flex flex-col gap-3">
            {sortedLevels.map(([level, count]) => (
              <div key={level} className="flex items-center gap-3">
                <div className="w-10 text-sm font-medium">{level}</div>
                <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(count / maxLevelCount) * 100}%` }}
                  ></div>
                </div>
                <div className="w-8 text-right text-sm text-zinc-500">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Reported Salaries ({data.salaries.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Role</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Level</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Location</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Exp</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Base</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Stock</th>
                <th className="px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Total Comp</th>
              </tr>
            </thead>
            <tbody>
              {data.salaries.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="px-6 py-3 font-medium">{s.role}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                      {s.level}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{s.location}</td>
                  <td className="px-6 py-3">{s.experience_years}y</td>
                  <td className="px-6 py-3 text-zinc-500">{formatCurrency(s.base_salary)}</td>
                  <td className="px-6 py-3 text-zinc-500">{formatCurrency(s.stock)}</td>
                  <td className="px-6 py-3 font-semibold text-green-700 dark:text-green-400">{formatCurrency(s.total_compensation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

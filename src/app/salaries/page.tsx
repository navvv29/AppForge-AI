"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Building, Briefcase, Filter } from 'lucide-react';

interface Salary {
  id: string;
  company: string;
  role: string;
  level: string;
  location: string;
  experience_years: number;
  total_compensation: number;
  base_salary: number;
  bonus: number;
  stock: number;
}

function SalariesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [role, setRole] = useState(searchParams.get('role') || '');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  
  // Sorting
  const [sortField, setSortField] = useState(searchParams.get('sort') || 'total_compensation_desc');

  // Comparison selection
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  useEffect(() => {
    const fetchSalaries = async () => {
      setLoading(true);
      setError('');
      try {
        const queryParams = new URLSearchParams(searchParams.toString());
        const res = await fetch(`/api/salaries?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch data');
        const data = await res.json();
        setSalaries(data);
      } catch (err) {
        setError('Error loading salaries');
      } finally {
        setLoading(false);
      }
    };

    fetchSalaries();
  }, [searchParams]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (company) params.set('company', company);
    if (role) params.set('role', role);
    if (level) params.set('level', level);
    if (location) params.set('location', location);
    params.set('sort', sortField);
    
    router.push(`/salaries?${params.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    setSortField(newSort);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    router.push(`/salaries?${params.toString()}`);
  };

  const handleCompareCheck = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold">Compensation Data</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">Explore real compensation data by level and role.</p>
        </div>
        
        {selectedForCompare.length > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              {selectedForCompare.length} selected for comparison
            </span>
            <Link 
              href={`/compare?id1=${selectedForCompare[0] || ''}&id2=${selectedForCompare[1] || ''}`}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedForCompare.length === 2 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
              onClick={(e) => selectedForCompare.length < 2 && e.preventDefault()}
            >
              Compare
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Company</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Role</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. SDE" className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="w-[120px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Level</label>
            <input type="text" value={level} onChange={e => setLevel(e.target.value)} placeholder="e.g. L4" className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Bengaluru" className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button type="submit" className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 w-[50px]">Comp</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Company</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Role</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Level</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Location</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Exp</th>
                <th className="px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-blue-500" onClick={() => handleSortChange(sortField === 'total_compensation_desc' ? 'total_compensation_asc' : 'total_compensation_desc')}>
                  Total Comp {sortField === 'total_compensation_desc' ? '↓' : sortField === 'total_compensation_asc' ? '↑' : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50">
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-10 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                    <td className="px-4 py-4"><div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div></td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-red-500">{error}</td></tr>
              ) : salaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500">
                      <Search className="w-10 h-10 mb-3 text-zinc-300 dark:text-zinc-700" />
                      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No salaries found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or search criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                salaries.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedForCompare.includes(s.id)}
                        onChange={() => handleCompareCheck(s.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium capitalize text-blue-600 dark:text-blue-400 hover:underline">
                      <Link href={`/company/${s.company}`}>{s.company}</Link>
                    </td>
                    <td className="px-4 py-3">{s.role}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                        {s.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.location}</td>
                    <td className="px-4 py-3">{s.experience_years}y</td>
                    <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">
                      {formatCurrency(s.total_compensation)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SalariesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center animate-pulse">Loading view...</div>}>
      <SalariesContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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

interface CompareData {
  salary1: Salary;
  salary2: Salary;
  diff: {
    base_diff: number;
    bonus_diff: number;
    stock_diff: number;
    total_diff: number;
    level_diff: string;
  };
}

function CompareContent() {
  const searchParams = useSearchParams();
  const id1 = searchParams.get('id1');
  const id2 = searchParams.get('id2');

  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id1 || !id2) {
      setError('Please select two salaries to compare.');
      setLoading(false);
      return;
    }

    const fetchCompare = async () => {
      try {
        const res = await fetch(`/api/compare?id1=${id1}&id2=${id2}`);
        if (res.status === 404) {
          setError('One or both salaries not found. Please try selecting again.');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Error loading comparison data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompare();
  }, [id1, id2]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-pulse">
        <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        <div className="h-96 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{error || "Comparison not available"}</h1>
        <p className="text-zinc-500 mb-6">Return to the salaries page and select two rows to compare.</p>
        <Link href="/salaries" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          Go to Salaries
        </Link>
      </div>
    );
  }

  const { salary1: s1, salary2: s2, diff } = data;

  const RowInfo = ({ label, val1, val2, formatter = String, higherIsBetter = false }: { label: string, val1: any, val2: any, formatter?: (v: any) => string, higherIsBetter?: boolean }) => {
    let highlight1 = false;
    let highlight2 = false;

    if (higherIsBetter && typeof val1 === 'number' && typeof val2 === 'number') {
      if (val1 > val2) highlight1 = true;
      if (val2 > val1) highlight2 = true;
    }

    return (
      <tr className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
        <td className="px-6 py-4 font-medium text-zinc-500 w-1/3">{label}</td>
        <td className={`px-6 py-4 w-1/3 text-lg ${highlight1 ? 'text-green-700 dark:text-green-400 font-bold bg-green-50/50 dark:bg-green-900/10' : ''}`}>
          {highlight1 && <CheckCircle2 className="inline w-4 h-4 mr-2" />}
          {formatter(val1)}
        </td>
        <td className={`px-6 py-4 w-1/3 text-lg ${highlight2 ? 'text-green-700 dark:text-green-400 font-bold bg-green-50/50 dark:bg-green-900/10' : ''}`}>
          {highlight2 && <CheckCircle2 className="inline w-4 h-4 mr-2" />}
          {formatter(val2)}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/salaries" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-extrabold">Offer Comparison</h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-sm font-semibold text-zinc-400 w-1/3">Criteria</th>
              <th className="px-6 py-4 w-1/3">
                <div className="text-xl font-bold capitalize">{s1.company}</div>
                <div className="text-sm font-normal text-zinc-500 mt-1">{s1.role}</div>
              </th>
              <th className="px-6 py-4 w-1/3">
                <div className="text-xl font-bold capitalize">{s2.company}</div>
                <div className="text-sm font-normal text-zinc-500 mt-1">{s2.role}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
              <td className="px-6 py-4 font-medium text-zinc-500">Level</td>
              <td className="px-6 py-4 font-semibold">{s1.level}</td>
              <td className="px-6 py-4 font-semibold">{s2.level}</td>
            </tr>
            <tr className="border-b border-zinc-100 dark:border-zinc-800/50 bg-blue-50/30 dark:bg-blue-900/10">
              <td className="px-6 py-3 font-medium text-zinc-500">Level Difference</td>
              <td colSpan={2} className="px-6 py-3 text-center font-medium text-blue-700 dark:text-blue-400">
                {diff.level_diff}
              </td>
            </tr>
            <RowInfo label="Location" val1={s1.location} val2={s2.location} />
            <RowInfo label="Experience" val1={s1.experience_years} val2={s2.experience_years} formatter={(v) => `${v} years`} />
            
            <tr className="border-y-4 border-zinc-100 dark:border-zinc-800"><td colSpan={3}></td></tr>
            
            <RowInfo label="Base Salary" val1={s1.base_salary} val2={s2.base_salary} formatter={formatCurrency} higherIsBetter={true} />
            <RowInfo label="Bonus" val1={s1.bonus} val2={s2.bonus} formatter={formatCurrency} higherIsBetter={true} />
            <RowInfo label="Stock (Equity)" val1={s1.stock} val2={s2.stock} formatter={formatCurrency} higherIsBetter={true} />
            
            <RowInfo label="Total Compensation" val1={s1.total_compensation} val2={s2.total_compensation} formatter={formatCurrency} higherIsBetter={true} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center animate-pulse">Loading comparison...</div>}>
      <CompareContent />
    </Suspense>
  );
}

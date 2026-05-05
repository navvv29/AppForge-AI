import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizeCompany } from '@/lib/normalize';

export async function GET(req: Request, { params }: { params: Promise<{ company: string }> }) {
  try {
    const rawCompany = (await params).company;
    const company = normalizeCompany(rawCompany);

    if (!company) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const salaries = await prisma.salary.findMany({
      where: { company },
      orderBy: { total_compensation: 'desc' }
    });

    if (!salaries || salaries.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Calculate median total_compensation
    const compensations = salaries.map(s => s.total_compensation).sort((a, b) => a - b);
    const mid = Math.floor(compensations.length / 2);
    const median_compensation = compensations.length % 2 !== 0 
      ? compensations[mid] 
      : (compensations[mid - 1] + compensations[mid]) / 2;

    // Calculate level distribution
    const level_distribution = salaries.reduce((acc: Record<string, number>, s) => {
      acc[s.level] = (acc[s.level] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      salaries,
      median_compensation,
      level_distribution
    });

  } catch (error) {
    console.error('Fetch company error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

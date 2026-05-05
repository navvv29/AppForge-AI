import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizeCompany } from '@/lib/normalize';
import { validateLevel } from '@/lib/validate';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      company,
      role,
      level,
      location,
      experience_years,
      base_salary,
      bonus = 0,
      stock = 0,
      confidence = 1.0
    } = body;

    // Validate required fields
    if (!company || typeof company !== 'string' || company.trim() === '') {
      return NextResponse.json({ error: 'Company is required and must be a non-empty string' }, { status: 400 });
    }
    if (!role || typeof role !== 'string' || role.trim() === '') {
      return NextResponse.json({ error: 'Role is required and must be a non-empty string' }, { status: 400 });
    }
    if (!level || typeof level !== 'string' || level.trim() === '' || !validateLevel(level)) {
      return NextResponse.json({ error: 'Level is required and must match L-number format (e.g. L3)' }, { status: 400 });
    }
    if (typeof base_salary !== 'number' || base_salary <= 0) {
      return NextResponse.json({ error: 'Base salary is required and must be a positive number' }, { status: 400 });
    }
    if (typeof experience_years !== 'number' || experience_years < 0 || !Number.isInteger(experience_years)) {
      return NextResponse.json({ error: 'Experience years is required and must be a non-negative integer' }, { status: 400 });
    }

    // Validate optionals
    if (bonus !== undefined && (typeof bonus !== 'number' || bonus < 0)) {
      return NextResponse.json({ error: 'Bonus must be a non-negative number' }, { status: 400 });
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return NextResponse.json({ error: 'Stock must be a non-negative number' }, { status: 400 });
    }
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      return NextResponse.json({ error: 'Confidence must be between 0 and 1' }, { status: 400 });
    }
    
    const validLocation = (typeof location === 'string' && location.trim() !== '') ? location.trim() : 'Unknown';

    const normalizedCompany = normalizeCompany(company);
    const total_compensation = base_salary + bonus + stock;

    // Check for near-duplicate
    const existing = await prisma.salary.findFirst({
      where: {
        company: normalizedCompany,
        role: role.trim(),
        level: level.trim().toUpperCase(),
        location: validLocation,
        experience_years
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Duplicate entry exists for this role profile' }, { status: 409 });
    }

    const salary = await prisma.salary.create({
      data: {
        company: normalizedCompany,
        role: role.trim(),
        level: level.trim().toUpperCase(),
        location: validLocation,
        experience_years,
        base_salary,
        bonus,
        stock,
        total_compensation,
        confidence_score: confidence
      }
    });

    return NextResponse.json(salary, { status: 201 });

  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

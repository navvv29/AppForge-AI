import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id1 = searchParams.get('id1');
    const id2 = searchParams.get('id2');

    if (!id1 || !id2) {
      return NextResponse.json({ error: 'Both id1 and id2 are required' }, { status: 404 });
    }

    const salary1 = await prisma.salary.findUnique({ where: { id: id1 } });
    const salary2 = await prisma.salary.findUnique({ where: { id: id2 } });

    if (!salary1 || !salary2) {
      return NextResponse.json({ error: 'One or both salaries not found' }, { status: 404 });
    }

    const diff = {
      base_diff: salary1.base_salary - salary2.base_salary,
      bonus_diff: salary1.bonus - salary2.bonus,
      stock_diff: salary1.stock - salary2.stock,
      total_diff: salary1.total_compensation - salary2.total_compensation,
      level_diff: salary1.level === salary2.level 
        ? "Same level" 
        : `${salary1.level} vs ${salary2.level}`
    };

    return NextResponse.json({
      salary1,
      salary2,
      diff
    });

  } catch (error) {
    console.error('Compare error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

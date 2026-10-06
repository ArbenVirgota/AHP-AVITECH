import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-adapter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const result = await authenticateUser(email, password);

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      user_id: result.user_id,
      name: result.name,
      email: result.email,
      status_user: result.status_user,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
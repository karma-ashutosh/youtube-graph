import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/creator-onboarding
 * Submit a creator onboarding request
 * Body: { creatorName: string, channelUrl: string, email: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { creatorName, channelUrl, email, reason } = await request.json();

    // Validate required fields
    if (!creatorName || !channelUrl || !email) {
      return NextResponse.json(
        { error: 'Creator name, channel URL, and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(channelUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid channel URL format' },
        { status: 400 }
      );
    }

    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS creator_onboarding_requests (
        id SERIAL PRIMARY KEY,
        creator_name VARCHAR(255) NOT NULL,
        channel_url TEXT NOT NULL,
        email VARCHAR(255) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending'
      )
    `);

    // Insert the request
    const result = await pool.query(
      `INSERT INTO creator_onboarding_requests
       (creator_name, channel_url, email, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [creatorName, channelUrl, email, reason || null]
    );

    // Log for assessment purposes
    console.log('Creator Onboarding Request Received:', {
      id: result.rows[0].id,
      creatorName,
      channelUrl,
      email,
      reason,
      timestamp: result.rows[0].created_at,
    });

    return NextResponse.json({
      success: true,
      message: 'Creator onboarding request submitted successfully',
      requestId: result.rows[0].id,
    });
  } catch (error: any) {
    console.error('Failed to submit creator onboarding request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/creator-onboarding
 * List all creator onboarding requests (for admin purposes)
 * Optional query params: ?status=pending|completed|rejected
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    let query = `
      SELECT
        id,
        creator_name,
        channel_url,
        email,
        reason,
        status,
        created_at
      FROM creator_onboarding_requests
    `;

    const values: string[] = [];

    if (status) {
      query += ' WHERE status = $1';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, values);

    return NextResponse.json({
      requests: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch creator onboarding requests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

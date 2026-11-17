import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const body = await request.json();
    const {
      type, // 'intake' or 'delivery'
      recipient_email,
      recipient_name,     // Who the package is for
      signed_by,          // Person who physically picked up & signed
      recipient_position, // Position of person signing
      packages,
      timestamp,
    } = body;

    if (!recipient_email) {
      return NextResponse.json({ error: 'No recipient email provided' }, { status: 400 });
    }

    const formattedTime = new Date(timestamp || Date.now()).toLocaleString('en-US', {
      timeZone: 'Pacific/Honolulu',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isIntake = type === 'intake';
    const subject = isIntake
      ? `Package Arrived at Mailroom (${packages?.[0]?.tracking_number || 'New Package'})`
      : `Package Delivered (${packages?.length || 1} item${packages?.length === 1 ? '' : 's'})`;

    const packageListHtml = (packages || [])
      .map(
        (pkg: {
          tracking_number: string;
          carrier?: string;
          notes?: string;
          building?: string;
          room_number?: string;
          photo_url?: string;
        }) => `
        <li style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
          <strong>Tracking #:</strong> ${pkg.tracking_number} (${pkg.carrier || 'Package'})<br/>
          ${pkg.building ? `<strong>Destination:</strong> ${pkg.building} ${pkg.room_number ? `Rm ${pkg.room_number}` : ''}<br/>` : ''}
          ${pkg.notes ? `<strong>Notes:</strong> ${pkg.notes}<br/>` : ''}
          ${
            pkg.photo_url
              ? `<div style="margin-top: 8px;">
                   <img src="${pkg.photo_url}" alt="Package Photo" style="max-width: 280px; border-radius: 6px; border: 1px solid #ddd;" />
                 </div>`
              : ''
          }
        </li>`
      )
      .join('');

    const messageHtml = isIntake
      ? `<p>Aloha ${recipient_name || 'Recipient'}, your package was received at the mailroom at <strong>${formattedTime}</strong>.</p>`
      : `<p>Aloha ${recipient_name || 'Recipient'}, your package was dropped off and was received and signed by <strong>${signed_by || recipient_name || 'Recipient'}</strong>${recipient_position ? ` (${recipient_position})` : ''} at <strong>${formattedTime}</strong>.</p>`;

    const data = await resend.emails.send({
      from: 'Mailroom <onboarding@resend.dev>',
      to: [recipient_email],
      subject,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #222;">
          <h2>${isIntake ? 'Package Received at Mailroom' : 'Package Delivery Confirmation'}</h2>
          ${messageHtml}
          <ul style="list-style: none; padding-left: 0; margin-top: 16px;">${packageListHtml}</ul>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
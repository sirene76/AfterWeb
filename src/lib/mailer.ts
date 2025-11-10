if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY");
}

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendWeeklyReport(email: string, subject: string, html: string) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AfterWeb Reports <noreply@afterweb.com>",
      to: [email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send report email: ${response.status} ${errorText}`);
  }
}

const BODY = `Contact: mailto:support@pigiecore.co.ke
Contact: https://officemanager.pigiecore.co.ke/security
Expires: 2027-11-26T00:00:00.000Z
Preferred-Languages: en
Canonical: https://officemanager.pigiecore.co.ke/.well-known/security.txt
Policy: https://officemanager.pigiecore.co.ke/security
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

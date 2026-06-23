import { NextRequest, NextResponse } from "next/server";

// Step 1 of OAuth: redirect the user to Google's consent screen with the
// Google Health read scopes. The callback (/api/health/callback) handles the
// code exchange. Client secret stays server-side throughout.

const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.ecg.readonly",
  "https://www.googleapis.com/auth/googlehealth.irn.readonly",
  // nutrition has no working data endpoint yet (reserved by Google); included
  // so we're ready when it ships — pulls nothing today.
  "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
];

export function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const appUrl = process.env.APP_URL || `https://${req.headers.get("host")}`;
  if (!clientId) {
    return NextResponse.json({ error: "Health integration not configured." }, { status: 400 });
  }

  const redirectUri = `${appUrl}/api/health/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // request a refresh token
    prompt: "consent", // ensure refresh token is returned
    // NOTE: deliberately NOT setting include_granted_scopes — mixing legacy
    // Google Fit scopes breaks Health API data reads (known 403 cause).
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}

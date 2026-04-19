// Resend client helper. The OAuth token from Replit Connectors is short-lived,
// so we always fetch fresh credentials before constructing a client.
import { Resend } from 'resend';

interface ResendConnectorSettings {
  api_key?: string;
  from_email?: string;
}

interface ResendConnectorItem {
  settings?: ResendConnectorSettings;
}

interface ResendConnectorResponse {
  items?: ResendConnectorItem[];
}

let cachedFromEmail: string | null = null;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error('Resend connector not available in this environment');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Resend connector (${response.status})`);
  }

  const data = (await response.json()) as ResendConnectorResponse;
  const settings = data.items?.[0]?.settings;
  const apiKey = settings?.api_key;
  const fromEmail = settings?.from_email ?? cachedFromEmail ?? undefined;

  if (!apiKey) {
    throw new Error('Resend not connected');
  }
  if (!fromEmail) {
    throw new Error('Resend connection is missing a verified "from" email');
  }

  cachedFromEmail = fromEmail;
  return { apiKey, fromEmail };
}

export async function getUncachableResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

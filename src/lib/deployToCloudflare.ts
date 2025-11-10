interface CloudflareDeploymentResult {
  id: string;
  short_id?: string;
  url?: string;
  deployment_trigger?: { type: string };
  latest_stage?: {
    name: string;
    status: string;
    ended_on?: string;
  };
  deployment_url?: string;
}

interface CloudflareDeploymentResponse {
  success: boolean;
  result?: CloudflareDeploymentResult;
  errors?: Array<{ code?: number; message: string }>;
  messages?: Array<{ message: string }>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in the environment`);
  }
  return value;
}

export async function deployToCloudflare(siteId: string): Promise<string> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const projectName = requireEnv("CLOUDFLARE_PROJECT_NAME");
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deployment_trigger: {
        type: "manual",
      },
      metadata: {
        siteId,
        triggeredBy: "AfterWeb",
      },
      production: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare deployment failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const payload = (await response.json()) as CloudflareDeploymentResponse;
  if (!payload.success || !payload.result) {
    const message = payload.errors?.map((err) => err.message).join(", ") ?? "Unknown error";
    throw new Error(`Cloudflare deployment failed: ${message}`);
  }

  const deploymentUrl =
    payload.result.deployment_url ??
    payload.result.url ??
    `https://${projectName}.pages.dev`;

  return deploymentUrl;
}

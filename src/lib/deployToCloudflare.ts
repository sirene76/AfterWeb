import type { WebsiteDocument } from "@/models/Website";

export type DeployResult = {
  previewUrl?: string;
};

async function triggerCloudflareDeploy(
  zipUrl: string,
  projectName: string,
  token: string,
  accountId: string,
): Promise<DeployResult> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deployment_trigger: { metadata: { source: "afterweb" }, type: "simple" },
      url: zipUrl,
    }),
  });

  const data = (await res.json()) as { result?: { url?: string }; errors?: Array<{ message?: string }> };

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.message ?? "Cloudflare deploy failed");
  }

  return { previewUrl: data.result?.url };
}

export async function deployToCloudflare(
  website: WebsiteDocument,
  rootDir: string,
): Promise<DeployResult>;
export async function deployToCloudflare(
  zipUrl: string,
  projectName: string,
  token: string,
  accountId: string,
): Promise<string | undefined>;
export async function deployToCloudflare(
  ...args:
    | [WebsiteDocument, string]
    | [string, string, string, string],
): Promise<DeployResult | string | undefined> {
  if (typeof args[0] === "string") {
    const [zipUrl, projectName, token, accountId] = args;
    const result = await triggerCloudflareDeploy(zipUrl, projectName, token, accountId);
    return result.previewUrl;
  }

  const [website, rootDir] = args as [WebsiteDocument, string];
  const zipUrl = website.zipUrl ?? website.archiveUrl;
  if (!zipUrl) {
    throw new Error("Missing zipUrl for deployment");
  }

  // The extracted root directory is reserved for future use (zipping/uploading directly).
  void rootDir;

  const projectName = process.env.CLOUDFLARE_PROJECT_NAME;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!projectName || !token || !accountId) {
    throw new Error("Cloudflare configuration missing");
  }

  // rootDir is reserved for future use (zipping local files) but unused for now.
  return triggerCloudflareDeploy(zipUrl, projectName, token, accountId);
}

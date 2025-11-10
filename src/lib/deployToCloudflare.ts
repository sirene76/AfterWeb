export async function deployToCloudflare(zipUrl: string, projectName: string, token: string, accountId: string) {
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
  const data = (await res.json()) as { result?: { url?: string }; errors?: Array<{ message?: string }>; };
  if (!res.ok) throw new Error(data.errors?.[0]?.message ?? "Cloudflare deploy failed");
  return data.result?.url;
}

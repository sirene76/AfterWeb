export async function deployToCloudflare(siteId: string): Promise<string> {
  const projectName = process.env.CLOUDFLARE_PROJECT_NAME ?? "afterweb";
  const url = `https://${projectName}-${siteId}.pages.dev`;

  console.info(`[AfterWeb] Starting mock deploy for site ${siteId}`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  console.info(`[AfterWeb] Deployment finished at ${url}`);

  return url;
}

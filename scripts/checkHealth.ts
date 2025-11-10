#!/usr/bin/env tsx
/**
 * 🚀 AfterWeb Health Check & Auto-Fix Tool
 * Verifies environment setup, installs missing dependencies, and scaffolds .env.local if needed.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// --- Required dependencies and versions ---
const requiredPackages: Record<string, string> = {
  next: "15.x",
  react: "19.x",
  "react-dom": "19.x",
  mongoose: "^8.0.0",
  cheerio: "^1.0.0",
  "adm-zip": "^0.5.0",
  swr: "^2.2.0",
  "@uploadthing/react": "^7.3.3",
  "@uploadthing/server": "^7.3.3",
  "@uploadthing/shared": "^6.7.2",
  "next-auth": "^5.0.0",
  tailwindcss: "^3.4.0",
  postcss: "^8.4.0",
  autoprefixer: "^10.4.0",
};

// --- Utility functions ---
function run(cmd: string) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Error running: ${cmd}`);
  }
}

function readPackageJSON() {
  try {
    return JSON.parse(fs.readFileSync("package.json", "utf8"));
  } catch {
    return {};
  }
}

function isPackageInstalled(pkg: string) {
  const pkgJson = readPackageJSON();
  return (
    pkgJson.dependencies?.[pkg] ||
    pkgJson.devDependencies?.[pkg] ||
    false
  );
}

// --- Step 1: Check and auto-install dependencies ---
function checkAndInstallPackages() {
  console.log("\n🧩 Checking dependencies...\n");
  const missing: string[] = [];

  for (const pkg of Object.keys(requiredPackages)) {
    if (isPackageInstalled(pkg)) {
      console.log(`✅ ${pkg} installed`);
    } else {
      console.log(`⚠️ Missing ${pkg}`);
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    console.log(`\n📦 Installing missing packages: ${missing.join(", ")}\n`);
    run(`pnpm add ${missing.join(" ")}`);
  } else {
    console.log("\n✨ All dependencies installed correctly!");
  }
}

// --- Step 2: Verify .env.local and create if missing ---
function ensureEnvFile() {
  console.log("\n🔐 Checking .env.local ...\n");
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.log("⚠️ .env.local not found. Creating template...");
    const content = `# === AfterWeb Environment ===
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/afterweb
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_PROJECT_NAME=afterweb
NEXTAUTH_SECRET=changeme
`;
    fs.writeFileSync(envPath, content, "utf8");
    console.log("✅ Created .env.local template");
  } else {
    console.log("✅ .env.local found");
  }
}

// --- Step 3: Verify Tailwind configuration ---
function ensureTailwindConfig() {
  console.log("\n🎨 Checking Tailwind config ...\n");
  if (!fs.existsSync("tailwind.config.ts") && !fs.existsSync("tailwind.config.js")) {
    console.log("⚠️ Missing Tailwind config — generating one...");
    run("npx tailwindcss init -p");
  } else {
    console.log("✅ Tailwind config present");
  }
}

// --- Step 4: Verify tsconfig alias ---
function ensureTsconfig() {
  console.log("\n🧠 Checking tsconfig.json ...\n");
  const tsPath = path.join(process.cwd(), "tsconfig.json");
  if (!fs.existsSync(tsPath)) {
    console.log("⚠️ tsconfig.json missing — creating minimal config...");
    fs.writeFileSync(
      tsPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ESNext",
            module: "ESNext",
            moduleResolution: "Node",
            baseUrl: "src",
            paths: { "@/*": ["*"] },
            jsx: "preserve",
            allowJs: true,
            strict: true,
            skipLibCheck: true,
          },
          include: ["src"],
        },
        null,
        2
      )
    );
  } else {
    const ts = JSON.parse(fs.readFileSync(tsPath, "utf8"));
    if (!ts.compilerOptions?.paths?.["@/*"]) {
      ts.compilerOptions = ts.compilerOptions || {};
      ts.compilerOptions.paths = { "@/*": ["*"] };
      fs.writeFileSync(tsPath, JSON.stringify(ts, null, 2));
      console.log("✅ Added @/* path alias");
    } else {
      console.log("✅ tsconfig alias already configured");
    }
  }
}

// --- Run all checks ---
console.log("\n🚀 Running AfterWeb Environment Health & Auto-Fix\n");
checkAndInstallPackages();
ensureEnvFile();
ensureTailwindConfig();
ensureTsconfig();
console.log("\n✅ Environment ready! You can now run `pnpm dev`\n");

import fs from "fs";
import path from "path";

function walk(dir: string, cb: (file: string) => void) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) walk(res, cb);
    else if (entry.name === "layout.tsx") cb(res);
  }
}

walk("src/app", (file) => {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes('"use client"'))
    console.warn(`⚠️  ${file} contains "use client" — remove it.`);
  if (!content.includes("children"))
    console.warn(`⚠️  ${file} may not pass children prop.`);
});

console.log("✅ Layout validation complete");

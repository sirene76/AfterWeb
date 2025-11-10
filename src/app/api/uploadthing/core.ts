import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const ourFileRouter = {
  websiteZip: f({ blob: { maxFileSize: "32MB" } })
    .onUploadComplete(async ({ file }) => {
      console.log("Uploaded file:", file.url);
      return { fileUrl: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

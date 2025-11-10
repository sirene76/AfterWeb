import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  websiteZip: f({ zip: { maxFileSize: "25MB" } }).onUploadComplete(async ({ file }) => {
    return { fileUrl: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

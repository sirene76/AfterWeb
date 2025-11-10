import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  websiteZip: f({ zip: { maxFileSize: "25MB" } }).onUploadComplete(async ({ file }) => {
    console.log("Uploaded file to R2:", file.url);
    return { fileUrl: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

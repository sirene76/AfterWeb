import { createNextRouteHandler } from "@uploadthing/server";

import { ourFileRouter } from "./core";

export const { GET, POST } = createNextRouteHandler({
  router: ourFileRouter,
});

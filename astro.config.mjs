import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://portfolio.faysalahmed.ca",
  integrations: [react()],
  output: "static",
});

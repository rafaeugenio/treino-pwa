import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173/treino-pwa/" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/treino-pwa/",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "webkit",
      use: {
        ...devices["iPhone 15"],
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["iPhone 15"],
        defaultBrowserType: undefined,
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});

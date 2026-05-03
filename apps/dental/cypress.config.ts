import { defineConfig } from 'cypress';

const baseUrl =
  process.env.CYPRESS_BASE_URL ||
  process.env.CYPRESS_baseUrl ||
  'http://localhost:3000'

export default defineConfig({
  e2e: {
    baseUrl,
    viewportWidth: 1280,
    viewportHeight: 720,
    video: process.env.CYPRESS_VIDEO !== 'false',
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    setupNodeEvents(on, config) {
      if (process.env.CYPRESS_COVERAGE === 'true') {
        require('@cypress/code-coverage/task')(on, config);
      }
      
      return config;
    },
    
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
  },
  
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
});

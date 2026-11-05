# SelfiePortfolio

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.4.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

API requests are forwarded through a local gateway to `BACKEND_URL` (configured as `https://selfie.tanmaysinghx.com/`). The gateway loads `.env` and then `.env.local`, which takes precedence. Set `BACKEND_API_KEY` in your local env file; it stays server-side. Restart `npm start` after changing these settings. Browser requests still show the local `/api` URL because the gateway makes the remote call.

The backend URL defaults to `https://selfie.tanmaysinghx.com/` in `api/_lib/backend.ts`, including on Vercel. `BACKEND_URL` is an optional environment override. Configure the secret `BACKEND_API_KEY` in Vercel's environment variables and redeploy to apply changes. The health endpoint's `env.BACKEND_URL` field reports whether an environment override is present; `false` is normal when using the code default.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
"# selfie-portfolio" 

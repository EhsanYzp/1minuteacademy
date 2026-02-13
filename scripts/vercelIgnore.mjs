#!/usr/bin/env node

const branch = process.env.VERCEL_GIT_COMMIT_REF;
const deployTarget = process.env.DEPLOY_TARGET;

// Vercel semantics:
// - exit 0 => ignore (skip) the build
// - exit 1 => proceed with the build

// If not using this mechanism, never block deploys.
if (!deployTarget || !branch) {
  process.exit(1);
}

// Goal:
// - Prod project should only build on `main`
// - Staging project should build on everything except `main`
if (deployTarget === 'prod') {
  process.exit(branch === 'main' ? 1 : 0);
}

if (deployTarget === 'staging') {
  process.exit(branch === 'main' ? 0 : 1);
}

// Unknown target: don't block deploys.
process.exit(1);

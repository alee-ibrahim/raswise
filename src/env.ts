import { defineEnvVars } from "@sveltejs/kit/env";

// See https://svelte.dev/docs/kit/environment-variables
// All variables are read at runtime. They are optional here because the code
// checks for them itself (and they are not available at build time).
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
  BOT_TOKEN: { schema: optional },
  APP_HOST: { schema: optional },
  MONGO_URI: { schema: optional },
  DEBUG: { schema: optional },
});

import { withPayload } from '@payloadcms/next/withPayload';

export default withPayload({
  agentRules: false,
  poweredByHeader: false,
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  turbopack: { root: new URL('../..', import.meta.url).pathname },
});

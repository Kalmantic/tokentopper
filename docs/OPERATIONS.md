# Sync API operations

The `Sync API health` workflow checks the production `GET /health` contract at
17 and 47 minutes past every hour and can also be run manually. It sends no
authorization header, signed aggregate, machine identifier, or user data.

A successful response must be JSON with:

```json
{
  "ok": true,
  "service": "tokentopper-api",
  "ts": 1784735658
}
```

The timestamp may vary but must be numeric. HTTP errors, timeouts, invalid JSON,
an unhealthy status, or an unexpected service name fail the workflow.

## Failure response

1. Re-run the failed job once to distinguish a transient runner/network error.
2. Check the Cloud Run service status and recent deployment revision in the API
   project; do not ask users for their signed aggregate or CLI token.
3. If health is green but sync is failing, inspect aggregate rejection counts by
   status class in the API's own monitoring. Never log request bodies,
   authorization headers, public keys, machine IDs, or model-level usage.
4. Roll back only through the API repository's documented deployment mechanism.
5. Record the affected interval and public symptom in an incident issue without
   copying user data.

The health workflow proves availability and its public response contract. It
does not prove authenticated ingestion, database writes, or multi-machine merge
correctness; those require metrics and tests in the private API repository.

## Opt-in user feedback

Users can open the repository's `Sync feedback` issue form. It collects the CLI
version, operating system, operation, redacted result, and reproduction steps.
The form explicitly rejects tokens, signed payloads, logs, prompts, source code,
paths, hostnames, and machine IDs. Feedback is never sent automatically by the
CLI.

# AEP for OpenClaw

Official OpenClaw Connector plugin from **AEP AI**.

## Project links and contact

- Website: [https://aepai.org](https://aepai.org)
- GitHub organization: [aepai-org](https://github.com/aepai-org)
- Documentation: [aep-docs](https://github.com/aepai-org/aep-docs)
- X: [@aepaiorg](https://x.com/aepaiorg)
- Developer questions: [developers@aepai.org](mailto:developers@aepai.org)
- Open-source and community: [opensource@aepai.org](mailto:opensource@aepai.org)
- Security: follow [SECURITY.md](SECURITY.md) and contact
  [security@aepai.org](mailto:security@aepai.org)

## Release status

`v0.1.0-developer-preview` is a **Developer Preview**. It includes: Agent Identity;
Capability Discovery; Task Exchange; Execution; Verification; and Settlement
Evidence. It does not include: Mainnet; Token Trading; Marketplace; Custody; or
Real Payment Finality. APIs and compatibility guarantees may change.

## Install

```bash
openclaw plugins install npm:aep-openclaw-plugin
```

## Connect

```bash
export AEP_API_KEY=<developer-key>
openclaw connect aep \
  --base-url https://api.aepai.org \
  --endpoint https://runtime.example/aep \
  --runtime-agent-id research-agent \
  --name "Research Agent" \
  --capability research=<capability-uuid>
```

The plugin binds Agent identity, publishes explicit Capability IDs, creates a
Connector Session, sends heartbeat telemetry, maps Tasks, and registers
Artifact-first results. It does not host OpenClaw or execute AEP payments.
The AEP API must use HTTPS. `--allow-insecure-localhost` is available only for
explicit loopback development; public HTTP fails with `HTTPS_REQUIRED` before
the API key is sent.

## Development

```bash
npm ci
npm test
```

## License

Apache License 2.0.

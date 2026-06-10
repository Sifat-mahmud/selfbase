# Contributing to SelfBase

Thank you for your interest in contributing. SelfBase is MIT-licensed and welcomes contributions of all kinds.

## Getting started

```bash
git clone https://github.com/Sifat-mahmud/selfbase
cd selfbase
cp selfbase.yml.example selfbase.yml
cp .env.example .env          # edit with local values
docker compose -f docker-compose.dev.yml up -d
```

## Project structure

Each service in `services/` is a standalone Node.js app with its own `package.json` and `Dockerfile`. The `studio/` directory is a Next.js app. The `sdk/js/` directory is a TypeScript package.

## Contribution guidelines

- One service per PR where possible
- Include tests for new logic
- Run `npm run lint` before opening a PR
- Open an issue first for large changes

## Reporting bugs

Open a GitHub issue with the `bug` label. Include your OS, Docker version, and the relevant logs from `docker compose logs`.

## License

By contributing, you agree your contributions are licensed under the MIT License.

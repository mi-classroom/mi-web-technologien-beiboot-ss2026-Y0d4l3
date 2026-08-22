# Contributing

Dies ist ein Modulprojekt im Rahmen von "Web Technologien" (TH Köln, Master
Digital Science, SS 2026, siehe [README](README.md)) mit einer festen
Abgabefrist. Es werden im Rahmen dieses Kurses keine externen Beiträge
erwartet oder aktiv eingeworben — die folgenden Hinweise dokumentieren den
Arbeitsprozess für Transparenz und Nachvollziehbarkeit, falls das Projekt
darüber hinaus weiterentwickelt wird.

## Arbeitsweise

- Arbeit wird über **GitHub Issues** organisiert; Commits/PRs referenzieren
  das jeweilige Issue (`Closes #6` o. Ä.).
- Commit-Nachrichten folgen [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(lib): …`, `fix(demo): …`, `docs(adr): …`, `test:`, `chore:`, `ci:`).
- Features/Fixes entstehen in eigenen Branches, gehen per Pull Request nach
  `main`.
- Wesentliche technische Entscheidungen werden als
  [Decision Records](docs/decisions/) dokumentiert (Kontext, Optionen,
  Begründung, Konsequenzen).

## Lokal entwickeln

```bash
npm ci
npm test              # node:test-Suite
npm run lint          # ESLint
npm run format:check  # Prettier-Check
npm run bench          # Vorher/Nachher-Report der Robustheits-Fixes
```

Vor einem Commit sollten Tests, Lint und Format-Check grün sein — dieselben
Checks laufen auch in der [CI-Pipeline](.github/workflows/ci.yml).

## Code-Konventionen

- Die Library (`gesture-lib/`) bleibt framework- und dependency-frei —
  siehe [DR-001](docs/decisions/DR-001-library-architecture.md) und
  [DR-008](docs/decisions/DR-008-tooling-stack.md).
- Neue Gesten werden über die öffentliche `register()`-API hinzugefügt, nicht
  durch Eingriffe in interne Felder.
- Öffentliche API-Änderungen sind, wo möglich, additiv und rückwärtskompatibel
  (siehe z. B. [DR-005](docs/decisions/DR-005-timing-model.md): `holdFrames`
  bleibt neben `holdMs` gültig).

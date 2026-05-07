# Dependency audit checklist

Run these before a store release:

```bash
npm run audit:prod
npm run audit:all
```

`audit:prod` checks packages that are treated as production dependencies by npm.
`audit:all` also reports development/build tooling issues.

For this React/Capacitor app, many audit warnings commonly come from build tooling such as `react-scripts`. Those tools are not shipped as Node.js services inside the APK/AAB, but high and critical findings should still be reviewed before release.

Recommended triage process:

1. Run `npm audit --omit=dev --json > audit-prod.json`.
2. Fix direct production dependencies first.
3. Avoid `npm audit fix --force` unless you are ready to test a major dependency upgrade.
4. Re-run `npm test -- --watchAll=false --runInBand` and `npm run build` after every dependency change.
5. Keep the final `package-lock.json` committed after any safe dependency update.

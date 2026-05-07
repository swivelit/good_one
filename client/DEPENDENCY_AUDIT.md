# Dependency audit checklist

Run these before a store release:

```bash
npm run audit:prod
npm run audit:all
```

## Current release triage

`npm run audit:prod` should be clean after these changes:

- removed unused `react-360-view`
- moved test/build-only packages such as `react-scripts` and `@testing-library/*` to `devDependencies`
- upgraded `axios` to `^1.16.0`

`npm run audit:all` can still report issues from development/build tooling, especially `react-scripts` and `@capacitor/assets`. These packages are used to build the app and generate assets; they are not shipped as a Node.js runtime inside the APK/AAB. Review them before release, but prioritize anything that appears in `audit:prod`.

## Rules

1. Fix direct production dependencies first.
2. Do not blindly run `npm audit fix --force`; it can downgrade or replace major build tooling and break the app.
3. After every dependency change, run:

```bash
npm test -- --watchAll=false --runInBand
npm run build
```

4. Commit the final `package.json` and `package-lock.json` together.

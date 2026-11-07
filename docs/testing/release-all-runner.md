# All-platform local release runner

Task: expose existing Windows, macOS, Linux, iOS and Android packaging pipelines
through `npm run release:all`. See the root README for requirements and options.

## TDD evidence

- RED: `node --test scripts/test-build-all-releases.cjs` failed because the runner
  module did not exist.
- GREEN: nine runner tests passed, including a real child Node process launched
  from a relocated project root containing spaces.
- Coverage: 97.35% lines, 92.86% branches, 100% functions for the runner.

| Guarantee | Evidence |
|---|---|
| All five platforms are selected by default | Default macOS plan test and actual npm dry run |
| iOS device archive versus simulator-only behavior is explicit | Argument/plan tests and help output |
| Unsupported hosts and missing tools cannot produce a successful overall result | Host, spawn-error and summary tests |
| Later platforms are attempted after earlier failures | Failed/stale/fresh plan test |
| Old artifacts or only one required format cannot count as complete | Stale/partial output tests |
| Artifact/report paths are project-root relative | Summary test |
| Dry run/help start no builds and create no files | Side-effect test |

Commands executed:

```bash
node --experimental-test-coverage --test scripts/test-build-all-releases.cjs
npm run release:plan
npm run release:all -- --dry-run
npm run release:all -- --help
node --check scripts/build-ios.js
git diff --check
```

The existing iOS archive script now exits nonzero on archive failure instead of
printing a warning and returning success. Actual Xcode archive execution was not
rerun for this orchestration change. Full platform builds were not invoked: the
requested deliverable was the command, and running the existing pipelines can
replace their previous release outputs. No binaries or previews were changed.

## Self-evaluation

Accuracy 4/5: command behavior tested; full platform pipelines not rerun.
Completeness 4/5: all five existing pipelines wired; IPA export remains outside the
existing iOS script and is documented. Clarity 4/5: prerequisites, failures and
local-package scope are explicit in the README. Actionability 4/5: one executable
command plus dry-run/subset options; platform toolchains must be installed.
Conciseness 4/5: shared runner reuses platform scripts; detailed evidence is here.
Overall 4.0/5. Further verification would run the actual pipelines with configured
signing, which was not required to validate command orchestration.

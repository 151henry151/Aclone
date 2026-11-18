# Laptop GPU CI runner

Henry authorizes the laptop's NVIDIA Quadro M1200 for Aclone CI. The complete
browser suite runs for pushes to main, in sixteen serial shards. Every case remains
assigned exactly once; smaller shards leave room within the existing 20-minute
suite and 25-minute job deadlines. Hosted workers still
run formatting, TypeScript, unit tests and software-rendered root and `/aclone/`
smoke checks for pushes and pull requests. Main's full workflow is the deployment
gate; a pull request's smoke checks alone are not release acceptance.

The runner is installed outside the development checkout at
`~/.local/share/aclone-gpu-ci/`. Its user service is `aclone-gpu-runner.service`.
It needs the laptop awake, network access and the logged-in NVIDIA display session.
CI uses game port 33173; its readiness check requires the spawned process and the
checkout’s exact Aclone version. Host networking is shared, so an unrelated
application’s successful health response must never authorize browser input.
A missing display or software fallback fails the renderer preflight, rather than
silently accepting weaker performance. Every GPU shard uploads its renderer name.
Do not run local benchmarks or GPU-heavy applications alongside performance CI.

## Isolation and trusted jobs

The service launches through a host-installed copy of
`scripts/ci/run-laptop-runner.sh`. Bubblewrap gives it a separate writable home and
checkout, private process/IPC namespaces and temporary directories, and a read-only
system filesystem. The user's home, SSH/GitHub credentials, desktop IPC and Docker
socket are hidden. Only the NVIDIA devices and read-only X display cookie/socket
are exposed for hardware GL. This is a trusted-code runner, not a sandbox for
arbitrary public contributions; X access and GPU access still require trust.

The workflow selects this runner only on main pushes. A separately installed,
read-only `scripts/ci/guard-job.sh` also checks the runner-provided repository,
event, ref and workflow context before any job steps. It kills the worker on a
mismatch so even an `if: always()` job step cannot continue. The runner listener
reports failure and remains available. Do not remove this gate or replace it with
an ordinary workflow step. No long-lived GitHub token is supplied to jobs, and
checkout does not persist its temporary credential.

GitHub cautions against public-repository self-hosted runners; the host gate and
isolation are deliberate requirements here. See
[GitHub's security guidance](https://docs.github.com/en/actions/reference/security/secure-use)
and [job hooks](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts).
The walking smoke test captures its optional success screenshots on GPU runs.
Software smoke keeps the same actions, assertions and deadlines, plus automatic
failure screenshots and traces, without expensive success-image readback.

Only reviewed changes to main may run. Changes to the host-installed scripts must
be reviewed and copied explicitly; a checkout cannot update its own host policy.

## Operation

```sh
systemctl --user status aclone-gpu-runner.service
journalctl --user -u aclone-gpu-runner.service -n 50 --no-pager
systemctl --user stop aclone-gpu-runner.service
systemctl --user start aclone-gpu-runner.service
gh api repos/151henry151/Aclone/actions/runners --jq '.runners[] | {name,status,busy}'
```

The service captures DISPLAY and XAUTHORITY for the current desktop session. If a
new login changes the cookie path, update those service values and reload/restart
the service. Jobs wait while the laptop is asleep or the runner is stopped; waiting
is not a passing check. Stop the service before host maintenance or local graphics
benchmarks. GitHub removes background job processes after each job; the runner's
private temporary directory is discarded when the service stops.

Register using GitHub's short-lived registration-token API, never a token written
into a command, repository file or log. Verify the official runner release SHA256
before unpacking. Keep the runner current, and do not grant it sudo or Docker.
The user service must invoke the official `runsvc.sh` through the isolation wrapper.

## Verification

```sh
node --import tsx --test tests/ci-runner-guard.test.ts
# Expected failure: the default browser is intentionally software-rendered.
node --import tsx scripts/verify-ci-gpu.ts
# Expected success: report NVIDIA Quadro M1200, never SwiftShader/llvmpipe.
TEST_GPU=1 node --import tsx scripts/verify-ci-gpu.ts
```

The full main run retains all individual test deadlines and graphics thresholds.
The parked-fleet test attaches each active/parked, low/normal profiler JSON, log,
raw frame/render timing JSON with CDP counters, and fleet screenshot before
assertions. The raw samples are already collected by the benchmark and saved only
after measurement; no sampling or acceptance threshold changes. These copies live with Playwright results
and are included in failed-job artifacts; ignored local `output/` is not uploaded.
Keep the exact-SHA CI gate in [RELEASING](RELEASING.md), including its post-deploy
check. Diagnose failures before continuing to the next backlog item.

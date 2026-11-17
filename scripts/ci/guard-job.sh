#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Install outside the checkout as ACTIONS_RUNNER_HOOK_JOB_STARTED. GitHub's
# hook handler supplies these values from its runtime context, not job env.
set -eu
if [[ ${GITHUB_REPOSITORY:-} != 151henry151/Aclone ||
      ${GITHUB_EVENT_NAME:-} != push ||
      ${GITHUB_REF:-} != refs/heads/main ||
      ${GITHUB_WORKFLOW_REF:-} != 151henry151/Aclone/.github/workflows/ci.yml@refs/heads/main ]]; then
  echo 'Rejecting untrusted GPU job before executing any steps.' >&2
  # Failing a step alone permits subsequent `if: always()` steps. Kill the
  # Runner.Worker parent instead; the listener reports failure and survives.
  kill -KILL "$PPID"
  exit 1
fi
echo 'Trusted main job accepted by laptop GPU gate.'

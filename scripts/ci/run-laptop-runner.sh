#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Host service launcher. Never run this from a checked-out CI job.
set -euo pipefail
state=${ACLONE_GPU_RUNNER_STATE:-"$HOME/.local/share/aclone-gpu-ci"}
auth=${XAUTHORITY:?The logged-in GPU session must provide XAUTHORITY}
display=${DISPLAY:?The logged-in GPU session must provide DISPLAY}
# Keep the host home, IPC sockets, processes and credentials out of jobs. The
# read-only display cookie/socket is needed for NVIDIA's GLX hardware context.
exec /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin /usr/bin/bwrap \
  --unshare-user --unshare-pid --unshare-ipc --unshare-uts --die-with-parent --new-session \
  --ro-bind / / --tmpfs /home --tmpfs /root --tmpfs /run --tmpfs /tmp --tmpfs /var/tmp --tmpfs /opt \
  --proc /proc --dev /dev \
  --dev-bind /dev/dri /dev/dri \
  --dev-bind /dev/nvidia0 /dev/nvidia0 \
  --dev-bind /dev/nvidiactl /dev/nvidiactl \
  --dev-bind /dev/nvidia-modeset /dev/nvidia-modeset \
  --dev-bind /dev/nvidia-uvm /dev/nvidia-uvm \
  --bind "$state/home" /home/runner \
  --ro-bind "$state/guard-job.sh" /opt/aclone-ci-guard.sh \
  --ro-bind "$auth" /tmp/ci-xauthority \
  --ro-bind /tmp/.X11-unix /tmp/.X11-unix \
  --setenv HOME /home/runner --setenv USER henry --setenv LANG C.UTF-8 \
  --setenv DISPLAY "$display" --setenv XAUTHORITY /tmp/ci-xauthority \
  --setenv RUNNER_TOOL_CACHE /home/runner/toolcache \
  --setenv AGENT_TOOLSDIRECTORY /home/runner/toolcache \
  --setenv ACTIONS_RUNNER_HOOK_JOB_STARTED /opt/aclone-ci-guard.sh \
  --chdir /home/runner/actions-runner \
  -- /bin/bash ./runsvc.sh

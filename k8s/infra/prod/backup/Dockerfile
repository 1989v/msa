# Backup runner image: bakes the existing docker/backup/scripts/
# tree and installs every CLI the scripts shell out to (xtrabackup,
# mysql, mysqldump, pg_dump, aws, gsutil). The K8s CronJobs in this
# directory run this image with the scripts as their entrypoint.
#
# Build with:
#   docker build -f k8s/infra/prod/backup/Dockerfile \
#     -t commerce/backup-runner:latest .
# (from the repo root so the COPY paths resolve)
#
# This is the one place the ADR-0019 scaffolding keeps a Dockerfile
# for non-Jib content on purpose — shell scripts with OS-level
# dependencies are outside Jib's remit.

FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash \
      curl \
      ca-certificates \
      gnupg \
      lsb-release \
      mysql-client \
      postgresql-client \
      xz-utils \
      zstd \
      jq \
      tini \
 && rm -rf /var/lib/apt/lists/*

# Percona XtraBackup for MySQL 8 physical backups.
RUN curl -fsSL https://repo.percona.com/apt/percona-release_latest.generic_all.deb \
        -o /tmp/percona-release.deb \
 && apt-get update \
 && apt-get install -y --no-install-recommends /tmp/percona-release.deb \
 && percona-release setup ps80 \
 && apt-get update \
 && apt-get install -y --no-install-recommends percona-xtrabackup-80 \
 && rm -rf /var/lib/apt/lists/* /tmp/percona-release.deb

# AWS CLI v2 (static, pinned architecture).
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscli.zip \
 && apt-get update && apt-get install -y --no-install-recommends unzip \
 && unzip -q /tmp/awscli.zip -d /tmp \
 && /tmp/aws/install \
 && rm -rf /tmp/aws /tmp/awscli.zip \
 && apt-get purge -y unzip \
 && rm -rf /var/lib/apt/lists/*

# Google Cloud SDK for gcs.sh provider.
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
        > /etc/apt/sources.list.d/google-cloud-sdk.list \
 && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
        | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-cloud-cli \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /backup-runner

# Copy the existing shell scripts untouched. Any future script
# change lands in docker/backup/scripts/ and rebuilds this image.
COPY docker/backup/scripts/           /backup-runner/scripts/
COPY docker/backup/storage-providers/ /backup-runner/storage-providers/
COPY docker/backup/config/            /backup-runner/config/

RUN chmod +x /backup-runner/scripts/*.sh /backup-runner/storage-providers/*.sh

ENTRYPOINT ["/usr/bin/tini", "--"]
# Default command is overridden by each CronJob spec.
CMD ["/backup-runner/scripts/backup-full.sh"]

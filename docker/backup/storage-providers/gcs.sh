#!/usr/bin/env bash
# docker/backup/storage-providers/gcs.sh

upload_file() {
    local src="$1"
    local dest="gs://${GCS_BUCKET}/${2}"

    if [[ -d "$src" ]]; then
        gsutil -m rsync -r "$src/" "$dest/"
    else
        gsutil cp "$src" "$dest"
    fi

    echo "Uploaded to GCS: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local cutoff_date
    cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null \
                  || date -v-${retention_days}d +%Y-%m-%d)

    gsutil ls "gs://${GCS_BUCKET}/${prefix}/" | while read -r dir; do
        local dir_date
        dir_date=$(echo "$dir" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        if [[ -n "$dir_date" && "$dir_date" < "$cutoff_date" ]]; then
            gsutil -m rm -r "$dir"
            echo "Deleted GCS: $dir"
        fi
    done

    echo "Cleaned up GCS: ${prefix} (older than ${retention_days} days)"
}

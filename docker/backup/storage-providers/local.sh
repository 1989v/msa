#!/usr/bin/env bash
# docker/backup/storage-providers/local.sh

upload_file() {
    local src="$1"
    local dest="${LOCAL_BACKUP_DIR}/${2}"

    mkdir -p "$(dirname "$dest")"

    if [[ -d "$src" ]]; then
        rsync -a "$src/" "$dest/"
    else
        cp "$src" "$dest"
    fi

    echo "Uploaded to local: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local target_dir="${LOCAL_BACKUP_DIR}/${prefix}"

    if [[ -d "$target_dir" ]]; then
        find "$target_dir" -maxdepth 1 -mindepth 1 -mtime +"$retention_days" -exec rm -rf {} +
        echo "Cleaned up local: $target_dir (older than ${retention_days} days)"
    fi
}

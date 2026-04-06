#!/usr/bin/env bash
# docker/backup/storage-providers/s3.sh

_s3_cmd() {
    local cmd="aws s3"
    if [[ -n "${S3_ENDPOINT:-}" ]]; then
        cmd+=" --endpoint-url ${S3_ENDPOINT}"
    fi
    if [[ -n "${S3_REGION:-}" ]]; then
        cmd+=" --region ${S3_REGION}"
    fi
    echo "$cmd"
}

upload_file() {
    local src="$1"
    local dest="s3://${S3_BUCKET}/${2}"

    if [[ -d "$src" ]]; then
        $(_s3_cmd) sync "$src/" "$dest/"
    else
        $(_s3_cmd) cp "$src" "$dest"
    fi

    echo "Uploaded to S3: $dest"
}

cleanup_remote() {
    local prefix="$1"
    local retention_days="$2"
    local cutoff_date
    cutoff_date=$(date -d "-${retention_days} days" +%Y-%m-%d 2>/dev/null \
                  || date -v-${retention_days}d +%Y-%m-%d)

    $(_s3_cmd) ls "s3://${S3_BUCKET}/${prefix}/" | while read -r line; do
        local dir_date
        dir_date=$(echo "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
        if [[ -n "$dir_date" && "$dir_date" < "$cutoff_date" ]]; then
            $(_s3_cmd) rm --recursive "s3://${S3_BUCKET}/${prefix}/${dir_date}/"
            echo "Deleted S3: s3://${S3_BUCKET}/${prefix}/${dir_date}/"
        fi
    done

    echo "Cleaned up S3: ${prefix} (older than ${retention_days} days)"
}

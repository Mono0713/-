/** A size for people: "0.4 MB" for the small, whole megabytes from 100 MB. */
export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`

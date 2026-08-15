export interface ArtifactPathMetadata {
  readonly size: number
  isFile(): boolean
  isSymbolicLink(): boolean
}

export interface ArtifactManifestOptions {
  readonly rootDirectory: string
  readonly relativePaths: readonly string[]
  readonly inspectPath?: (path: string) => Promise<ArtifactPathMetadata>
}

export interface ArtifactHash {
  readonly path: string
  readonly size: number
  readonly sha256: string
}

export interface ArtifactManifest {
  readonly schemaVersion: 1
  readonly artifacts: readonly ArtifactHash[]
}

export interface WriteArtifactManifestOptions extends ArtifactManifestOptions {
  readonly outputPath: string
}

export function createArtifactManifest(options: ArtifactManifestOptions): Promise<ArtifactManifest>
export function writeArtifactManifest(
  options: WriteArtifactManifestOptions
): Promise<ArtifactManifest>

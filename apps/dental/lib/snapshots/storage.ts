/**
 * Snapshot Storage Service
 *
 * Wrapper para Supabase Storage para gestionar snapshots de clínicas.
 * Maneja upload, download, listado y eliminación de snapshots.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  deleteConvexStorageObject,
  downloadConvexStorageObject,
  getConvexStorageObjectUrl,
  uploadConvexStorageObject,
} from '@/lib/convex/server'
import { shouldReturnConvexData, shouldWriteConvexData } from '@/lib/data-backend'
import { createMirroredSupabaseClient } from '@/lib/convex/supabase-runtime-mirror'
import {
  SnapshotMetadata,
  StorageManifest,
  StorageConfig,
  DEFAULT_STORAGE_CONFIG,
  SnapshotError,
} from './types'

export class SnapshotStorageService {
  private config: StorageConfig
  private supabase: SupabaseClient

  constructor(
    supabase: SupabaseClient,
    config: Partial<StorageConfig> = {}
  ) {
    this.supabase = createMirroredSupabaseClient(supabase)
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config }
  }

  /**
   * Asegura que el bucket de storage existe.
   * Nota: En producción, el bucket debe crearse via migración SQL.
   */
  async ensureBucketExists(): Promise<void> {
    const { data: buckets, error } = await this.supabase.storage.listBuckets()

    if (error) {
      throw new SnapshotError(
        'Failed to list storage buckets',
        'STORAGE_UPLOAD_FAILED',
        error
      )
    }

    const bucketExists = buckets?.some(
      (b) => b.name === this.config.bucketName
    )

    if (!bucketExists) {
      // En producción, esto debería fallar y requerir creación via SQL
      console.warn(
        `Bucket ${this.config.bucketName} does not exist. Please create it via SQL migration.`
      )
    }
  }

  /**
   * Sube un snapshot a storage.
   */
  async upload(
    clinicId: string,
    snapshotId: string,
    data: Uint8Array
  ): Promise<string> {
    const path = this.getSnapshotPath(clinicId, snapshotId)

    // Convex-only: the Supabase storage bucket is unreachable; the blob lives in Convex
    // storage via the mirror. Symmetric with the download() convex branch.
    if (shouldReturnConvexData('storage')) {
      await this.mirrorUploadToConvex(path, data, 'application/gzip', 'snapshot-upload')
      return path
    }

    const { error } = await this.supabase.storage
      .from(this.config.bucketName)
      .upload(path, data, {
        contentType: 'application/gzip',
        upsert: false, // Never overwrite - snapshots are immutable
        cacheControl: '31536000', // Cache for 1 year (immutable)
      })

    if (error) {
      throw new SnapshotError(
        `Failed to upload snapshot: ${error.message}`,
        'STORAGE_UPLOAD_FAILED',
        error
      )
    }

    await this.mirrorUploadToConvex(path, data, 'application/gzip', 'snapshot-upload')

    return path
  }

  /**
   * Descarga un snapshot de storage.
   */
  async download(clinicId: string, snapshotId: string): Promise<Uint8Array> {
    const path = this.getSnapshotPath(clinicId, snapshotId)

    // Convex-first read (symmetric with the existing mirrorUploadToConvex write).
    // Falls back to Supabase when the blob is not mirrored (pre-mirror snapshots),
    // so production stays safe. Default Supabase => this branch is skipped.
    if (shouldReturnConvexData('storage')) {
      try {
        const bytes = await downloadConvexStorageObject(this.config.bucketName, path)
        if (bytes) return bytes
        // Not in Convex -> fall through to Supabase (do NOT throw).
      } catch (convexError) {
        if (process.env.CONVEX_STORAGE_MIRROR_STRICT === '1') {
          throw new SnapshotError(
            `Convex storage download failed: ${convexError instanceof Error ? convexError.message : 'unknown'}`,
            'STORAGE_DOWNLOAD_FAILED',
            convexError
          )
        }
        console.error(`Failed to read ${path} from Convex Storage, falling back to Supabase:`, convexError)
      }
    }

    const { data, error } = await this.supabase.storage
      .from(this.config.bucketName)
      .download(path)

    if (error) {
      if (error.message?.includes('not found')) {
        throw new SnapshotError(
          `Snapshot ${snapshotId} not found`,
          'SNAPSHOT_NOT_FOUND',
          error
        )
      }
      throw new SnapshotError(
        `Failed to download snapshot: ${error.message}`,
        'STORAGE_DOWNLOAD_FAILED',
        error
      )
    }

    return new Uint8Array(await data.arrayBuffer())
  }

  /**
   * Lista todos los snapshots de una clínica.
   * Lee del manifest guardado en storage.
   */
  async listSnapshots(clinicId: string): Promise<SnapshotMetadata[]> {
    const manifestPath = this.getManifestPath(clinicId)

    try {
      const { data, error } = await this.supabase.storage
        .from(this.config.bucketName)
        .download(manifestPath)

      if (error) {
        if (error.message?.includes('not found')) {
          return [] // No snapshots yet
        }
        throw error
      }

      const manifest: StorageManifest = JSON.parse(await data.text())
      return manifest.snapshots || []
    } catch (error) {
      // Si el manifest no existe, retornar array vacío
      if (error instanceof Error && error.message?.includes('not found')) {
        return []
      }
      throw new SnapshotError(
        'Failed to list snapshots',
        'STORAGE_DOWNLOAD_FAILED',
        error
      )
    }
  }

  /**
   * Elimina un snapshot de storage.
   */
  async delete(clinicId: string, snapshotId: string): Promise<void> {
    const path = this.getSnapshotPath(clinicId, snapshotId)

    const { error } = await this.supabase.storage
      .from(this.config.bucketName)
      .remove([path])

    if (error && !error.message?.includes('not found')) {
      throw new SnapshotError(
        `Failed to delete snapshot: ${error.message}`,
        'STORAGE_DOWNLOAD_FAILED',
        error
      )
    }

    await this.mirrorDeleteFromConvex(path)

    // Actualizar manifest para remover este snapshot
    await this.removeFromManifest(clinicId, snapshotId)
  }

  /**
   * Actualiza el manifest con un nuevo snapshot.
   */
  async updateManifestIndex(
    clinicId: string,
    metadata: SnapshotMetadata
  ): Promise<void> {
    const manifestPath = this.getManifestPath(clinicId)
    let manifest: StorageManifest = {
      snapshots: [],
      updatedAt: new Date().toISOString(),
    }

    // Intentar cargar manifest existente
    try {
      const { data } = await this.supabase.storage
        .from(this.config.bucketName)
        .download(manifestPath)

      if (data) {
        manifest = JSON.parse(await data.text())
      }
    } catch {
      // Manifest nuevo
    }

    // Agregar nuevo snapshot al inicio
    manifest.snapshots.unshift(metadata)
    manifest.updatedAt = new Date().toISOString()

    // Aplicar política de retención
    if (manifest.snapshots.length > this.config.maxSnapshotsPerClinic) {
      const toDelete = manifest.snapshots.slice(
        this.config.maxSnapshotsPerClinic
      )
      manifest.snapshots = manifest.snapshots.slice(
        0,
        this.config.maxSnapshotsPerClinic
      )

      // Eliminar archivos de snapshots antiguos
      for (const old of toDelete) {
        try {
          await this.deleteSnapshotFile(clinicId, old.id)
        } catch (error) {
          console.error(`Failed to delete old snapshot ${old.id}:`, error)
        }
      }
    }

    // Subir manifest actualizado
    const manifestPayload = JSON.stringify(manifest, null, 2)
    if (shouldReturnConvexData('storage')) {
      // Convex-only: write the manifest blob to Convex storage only.
      await this.mirrorUploadToConvex(manifestPath, manifestPayload, 'application/json', 'snapshot-manifest')
      return
    }

    const { error } = await this.supabase.storage
      .from(this.config.bucketName)
      .upload(manifestPath, manifestPayload, {
        contentType: 'application/json',
        upsert: true,
      })

    if (error) {
      throw new SnapshotError(
        `Failed to update manifest: ${error.message}`,
        'STORAGE_UPLOAD_FAILED',
        error
      )
    }

    await this.mirrorUploadToConvex(manifestPath, manifestPayload, 'application/json', 'snapshot-manifest')
  }

  /**
   * Remueve un snapshot del manifest.
   */
  private async removeFromManifest(
    clinicId: string,
    snapshotId: string
  ): Promise<void> {
    const manifestPath = this.getManifestPath(clinicId)

    try {
      const { data } = await this.supabase.storage
        .from(this.config.bucketName)
        .download(manifestPath)

      if (!data) return

      const manifest: StorageManifest = JSON.parse(await data.text())
      manifest.snapshots = manifest.snapshots.filter((s) => s.id !== snapshotId)
      manifest.updatedAt = new Date().toISOString()

      const manifestPayload = JSON.stringify(manifest, null, 2)
      await this.supabase.storage
        .from(this.config.bucketName)
        .upload(manifestPath, manifestPayload, {
          contentType: 'application/json',
          upsert: true,
        })

      await this.mirrorUploadToConvex(manifestPath, manifestPayload, 'application/json', 'snapshot-manifest')
    } catch (error) {
      console.error('Failed to update manifest after delete:', error)
    }
  }

  /**
   * Elimina solo el archivo de snapshot (no el manifest).
   */
  private async deleteSnapshotFile(
    clinicId: string,
    snapshotId: string
  ): Promise<void> {
    const path = this.getSnapshotPath(clinicId, snapshotId)

    await this.supabase.storage.from(this.config.bucketName).remove([path])
    await this.mirrorDeleteFromConvex(path)
  }

  /**
   * Genera la ruta del archivo de snapshot.
   */
  private getSnapshotPath(clinicId: string, snapshotId: string): string {
    return `${clinicId}/snapshots/${snapshotId}.json.gz`
  }

  /**
   * Genera la ruta del manifest.
   */
  private getManifestPath(clinicId: string): string {
    return `${clinicId}/manifest.json`
  }

  /**
   * Obtiene una URL firmada para descarga directa.
   */
  async getSignedUrl(
    clinicId: string,
    snapshotId: string,
    expiresIn = 3600
  ): Promise<string> {
    const path = this.getSnapshotPath(clinicId, snapshotId)

    // Convex-first: Convex serves blobs via a short-lived signed URL. Falls back
    // to Supabase when not mirrored. Default Supabase => branch skipped.
    if (shouldReturnConvexData('storage')) {
      try {
        const convexUrl = await getConvexStorageObjectUrl(this.config.bucketName, path)
        if (convexUrl) return convexUrl
      } catch (convexError) {
        if (process.env.CONVEX_STORAGE_MIRROR_STRICT === '1') {
          throw new SnapshotError(
            `Convex signed URL failed: ${convexError instanceof Error ? convexError.message : 'unknown'}`,
            'STORAGE_DOWNLOAD_FAILED',
            convexError
          )
        }
        console.error(`Failed to get Convex signed URL for ${path}, falling back to Supabase:`, convexError)
      }
    }

    const { data, error } = await this.supabase.storage
      .from(this.config.bucketName)
      .createSignedUrl(path, expiresIn)

    if (error) {
      throw new SnapshotError(
        `Failed to create signed URL: ${error.message}`,
        'STORAGE_DOWNLOAD_FAILED',
        error
      )
    }

    return data.signedUrl
  }

  /**
   * Obtiene información de uso de storage para una clínica.
   */
  async getStorageUsage(clinicId: string): Promise<{
    totalBytes: number
    snapshotCount: number
  }> {
    const { data, error } = await this.supabase.storage
      .from(this.config.bucketName)
      .list(clinicId + '/snapshots')

    if (error) {
      return { totalBytes: 0, snapshotCount: 0 }
    }

    const totalBytes =
      data?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0
    const snapshotCount = data?.length || 0

    return { totalBytes, snapshotCount }
  }

  /**
   * Limpia snapshots expirados basados en la política de retención.
   * Retorna el número de snapshots eliminados.
   */
  async cleanupExpired(clinicId: string): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

    // Get expired snapshots from database
    const { data: expiredSnapshots, error } = await this.supabase
      .from('clinic_snapshots')
      .select('id')
      .eq('clinic_id', clinicId)
      .lt('expires_at', cutoffDate.toISOString())

    if (error || !expiredSnapshots || expiredSnapshots.length === 0) {
      return 0
    }

    let deleted = 0

    for (const snapshot of expiredSnapshots) {
      try {
        // Delete from storage
        await this.deleteSnapshotFile(clinicId, snapshot.id)

        // Delete from database
        await this.supabase
          .from('clinic_snapshots')
          .delete()
          .eq('id', snapshot.id)

        deleted++
      } catch (deleteError) {
        console.error(`Failed to delete expired snapshot ${snapshot.id}:`, deleteError)
      }
    }

    // Update manifest
    if (deleted > 0) {
      try {
        const manifestPath = this.getManifestPath(clinicId)
        const { data } = await this.supabase.storage
          .from(this.config.bucketName)
          .download(manifestPath)

        if (data) {
          const manifest: StorageManifest = JSON.parse(await data.text())
          const expiredIds = new Set(expiredSnapshots.map((s) => s.id))
          manifest.snapshots = manifest.snapshots.filter(
            (s) => !expiredIds.has(s.id)
          )
          manifest.updatedAt = new Date().toISOString()

          const manifestPayload = JSON.stringify(manifest, null, 2)
          await this.supabase.storage
            .from(this.config.bucketName)
            .upload(manifestPath, manifestPayload, {
              contentType: 'application/json',
              upsert: true,
            })

          await this.mirrorUploadToConvex(manifestPath, manifestPayload, 'application/json', 'snapshot-manifest')
        }
      } catch (manifestError) {
        console.error('Failed to update manifest after cleanup:', manifestError)
      }
    }

    return deleted
  }

  private async mirrorUploadToConvex(
    path: string,
    data: Uint8Array | string,
    contentType: string,
    source: string
  ): Promise<void> {
    if (!shouldWriteConvexData('storage')) return

    try {
      await uploadConvexStorageObject({
        bucket: this.config.bucketName,
        path,
        data,
        contentType,
        source,
      })
    } catch (error) {
      if (process.env.CONVEX_STORAGE_MIRROR_STRICT === '1') {
        throw error
      }
      console.error(`Failed to mirror ${path} to Convex Storage:`, error)
    }
  }

  private async mirrorDeleteFromConvex(path: string): Promise<void> {
    if (!shouldWriteConvexData('storage')) return

    try {
      await deleteConvexStorageObject(this.config.bucketName, path)
    } catch (error) {
      if (process.env.CONVEX_STORAGE_MIRROR_STRICT === '1') {
        throw error
      }
      console.error(`Failed to delete ${path} from Convex Storage mirror:`, error)
    }
  }
}

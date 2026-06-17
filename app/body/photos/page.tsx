"use client";

import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db, type ProgressPhoto } from "@/lib/db";
import { generateId, todayISO, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Trash2, X } from "lucide-react";

const POSES: ProgressPhoto["pose"][] = ["front", "side", "back", "other"];

// Downscale an image file to a JPEG data URL (max 1080px long edge) so photos
// stay small enough for IndexedDB and the GitHub JSON backup.
async function fileToDataUrl(file: File, maxEdge = 1080, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export default function PhotosPage() {
  const [pose, setPose] = useState<ProgressPhoto["pose"]>("front");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ProgressPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photos = useLiveQuery(
    () => db.progressPhotos.orderBy("date").reverse().toArray(),
    []
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const data_url = await fileToDataUrl(file);
        const latestWeight = await db.bodyweightLogs.orderBy("date").reverse().first();
        await db.progressPhotos.add({
          id: generateId(),
          date: todayISO(),
          pose,
          data_url,
          weight_lbs: latestWeight?.weight_lbs ?? null,
          notes: null,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Photo import failed:", e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await db.progressPhotos.delete(id);
    setViewer(null);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/body">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Progress Photos</h1>
        </div>

        {/* Pose picker + capture */}
        <Card className="bg-[#121316] border-[#24262C]">
          <CardContent className="p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider">
              Pose
            </p>
            <div className="flex gap-2">
              {POSES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPose(p)}
                  className={`flex-1 h-9 rounded-lg text-xs font-bold uppercase transition-colors ${
                    pose === p
                      ? "bg-[#C7F23E] text-white"
                      : "bg-[#08090A] border border-[#24262C] text-[#5A5F66] hover:text-[#9BA0A6]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full">
              <Camera className="w-4 h-4 mr-2" />
              {busy ? "Saving…" : "Add photo"}
            </Button>
            <p className="text-[11px] text-[#5A5F66]">
              Photos are stored privately on this device and included in your backups.
              They&apos;re resized to keep storage small.
            </p>
          </CardContent>
        </Card>

        {/* Gallery */}
        {photos && photos.length === 0 && (
          <div className="text-center py-12">
            <Camera className="w-10 h-10 text-[#24262C] mx-auto mb-3" />
            <p className="text-[#5A5F66] text-sm">No photos yet</p>
            <p className="text-[#3A3D45] text-xs mt-1">
              Snap a front, side, and back shot to track visual progress
            </p>
          </div>
        )}

        {photos && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((ph) => (
              <button
                key={ph.id}
                onClick={() => setViewer(ph)}
                className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#24262C] bg-[#121316]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.data_url} alt={`${ph.pose} ${ph.date}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] py-0.5 text-center font-semibold uppercase tracking-wide">
                  {ph.pose}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      {viewer && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
          onClick={() => setViewer(null)}
        >
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold capitalize">{viewer.pose}</p>
              <p className="text-xs text-[#9BA0A6]">
                {formatDateShort(viewer.date)}
                {viewer.weight_lbs ? ` · ${viewer.weight_lbs} lbs` : ""}
              </p>
            </div>
            <button onClick={() => setViewer(null)} className="p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={viewer.data_url}
            alt={viewer.pose}
            className="flex-1 object-contain min-h-0"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="p-4" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleDelete(viewer.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete photo
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

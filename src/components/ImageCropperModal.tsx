import React, { useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, X, Image as ImageIcon, RefreshCw } from "lucide-react";

interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropSave: (croppedImageBase64: string) => void;
}

/**
 * Helper function to create cropped image canvas output
 */
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number = 0
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Gagal membuat konteks canvas 2D");
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = {
    width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
    height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
  };

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas center to image center and rotate
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw rotated image
  ctx.drawImage(image, 0, 0);

  // Cropped canvas
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Gagal membuat konteks canvas cropped");
  }

  // Set target cropped canvas dimensions (aspect ratio 16:9)
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Draw the cropped region from the rotated canvas onto the target canvas
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return croppedCanvas.toDataURL("image/jpeg", 0.92);
}

export default function ImageCropperModal({
  imageSrc,
  onClose,
  onCropSave,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onCropChange = useCallback((newCrop: Point) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropComplete = useCallback((_croppedArea: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropSave(croppedImage);
      onClose();
    } catch (err) {
      console.error("Error cropping image:", err);
      setErrorMessage(
        "Gagal memotong gambar. Jika ini tautan eksternal, proteksi CORS mungkin menghalanginya. Cobalah mengunggah gambar dari file komputer/HP Anda."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl">
              <Crop size={18} />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                Pemotong Foto (16:9 Aspect Ratio)
                <span className="bg-teal-600 text-white text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Explore Pacitan
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Geser & atur skala foto agar pas dengan bingkai kartu lokasi 16:9.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper Work Area */}
        <div className="relative w-full h-[360px] bg-slate-950 overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={16 / 9}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        {/* Error message fallback */}
        {errorMessage && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-3 text-xs text-rose-800 flex items-start gap-2">
            <ImageIcon className="shrink-0 text-rose-600 mt-0.5" size={14} />
            <div>
              <p className="font-bold">Proteksi Gambar Eksternal</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Controls Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <ZoomOut size={15} className="text-slate-400 shrink-0" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.05}
                aria-label="Perpindahan Zoom Foto"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <ZoomIn size={15} className="text-slate-400 shrink-0" />
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 w-10 text-right">
                {zoom.toFixed(1)}x
              </span>
            </div>

            {/* Utility buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="p-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Putar 90°"
              >
                <RotateCw size={14} /> Putar
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Reset Posisi & Zoom"
              >
                <RefreshCw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <Check size={14} /> Simpan Hasil Crop (16:9)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

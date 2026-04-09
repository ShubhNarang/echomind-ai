import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemoryImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
  thumbnailClassName?: string;
}

export function MemoryImageViewer({ src, alt = "Memory image", className, thumbnailClassName }: MemoryImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`cursor-pointer hover:opacity-90 transition-opacity ${thumbnailClassName ?? ""}`}
        onClick={() => setOpen(true)}
        loading="lazy"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 bg-background/80 h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={src}
              alt={alt}
              className={`w-full max-h-[80vh] object-contain rounded-lg ${className ?? ""}`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

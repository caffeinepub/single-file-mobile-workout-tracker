import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Share2, Copy, Check, Loader2 } from 'lucide-react';

interface WorkoutShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutId: string;
}

export default function WorkoutShareModal({ open, onOpenChange, workoutId }: WorkoutShareModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/shared/${workoutId}`;
  const canShare = typeof navigator !== 'undefined' && navigator.share !== undefined;

  useEffect(() => {
    if (open && !qrCodeUrl) {
      loadQRCode();
    }
  }, [open]);

  const loadQRCode = async () => {
    setIsLoadingQR(true);
    try {
      // Dynamically load QRCode.js from CDN
      if (!(window as any).QRCode) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Generate QR code
      const container = document.createElement('div');
      const qr = new (window as any).QRCode(container, {
        text: shareUrl,
        width: 256,
        height: 256,
        colorDark: '#229ED9',
        colorLight: '#0F0F0F',
        correctLevel: (window as any).QRCode.CorrectLevel.H,
      });

      // Wait for QR code to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = container.querySelector('canvas');
      if (canvas) {
        setQrCodeUrl(canvas.toDataURL());
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
      console.error('Copy error:', error);
    }
  };

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: 'My Workout',
          text: 'Check out my workout on FitTrack!',
          url: shareUrl,
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-t-2xl frosted-glass">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            Share Workout
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Share your workout with friends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* QR Code */}
          <div className="flex justify-center">
            {isLoadingQR ? (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-muted">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : qrCodeUrl ? (
              <div className="rounded-2xl bg-background p-4 shadow-glow-primary border-2 border-primary/30">
                <img src={qrCodeUrl} alt="QR Code" className="h-64 w-64" />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-muted">
                <p className="text-sm text-muted-foreground">QR code unavailable</p>
              </div>
            )}
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <Label htmlFor="share-link" className="text-base font-medium">
              Share Link
            </Label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                value={shareUrl}
                readOnly
                className="h-12 bg-input border-border text-sm"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0 hover:bg-white/10 rounded-xl transition-all hover:shadow-glow-primary active:scale-90"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Share Button */}
          <Button
            onClick={handleShare}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base font-medium shadow-glow-primary hover:shadow-glow-primary hover:scale-105 active:scale-95 transition-all"
          >
            <Share2 className="mr-2 h-5 w-5" />
            {canShare ? 'Share Workout' : 'Copy Link'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Anyone with this link can view your workout details
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
